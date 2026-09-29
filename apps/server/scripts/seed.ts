// Idempotent: clears users and companies, then recreates two tenants with known credentials.
// Run from the repo root with: pnpm db:seed
import "varlock/auto-load";

import { createDb } from "@multi-tenant-ai-catalog/db";
import mongoose from "mongoose";

import { env } from "../src/config/env";
import { PasswordHasher } from "../src/modules/auth/password";
import { CompanyModel } from "../src/modules/companies/company.model";
import { UserModel } from "../src/modules/users/user.model";
import type { Role } from "../src/shared/context";
import { BYPASS_TENANT_SCOPE } from "../src/shared/db/tenant-scoped.plugin";

const PASSWORD = "password123";

// Two clearly different segments, so the AI agent's answers make cross-tenant leaks obvious.
const TENANTS = [
  { name: "Pet Feliz", slug: "petfeliz" },
  { name: "Volt Eletrônicos", slug: "volt" },
] as const;

async function clear() {
  // Tenant-scope bypass #2 (the other is UserRepository.findByEmailAcrossTenants):
  // wiping every tenant's data is exactly what the seed is for.
  await UserModel.deleteMany({}).setOptions({ [BYPASS_TENANT_SCOPE]: true });
  await CompanyModel.deleteMany({});
}

async function seed() {
  await createDb(env);
  // Wait for indexes (unique email) before inserting.
  await Promise.all([CompanyModel.init(), UserModel.init()]);
  await clear();

  const passwordHash = await new PasswordHasher().hash(PASSWORD);
  const credentials: { company: string; email: string; password: string; role: Role }[] = [];

  for (const tenant of TENANTS) {
    const company = await CompanyModel.create({ name: tenant.name });
    for (const role of ["admin", "user"] as const) {
      const email = `${role}@${tenant.slug}.test`;
      await UserModel.create({
        company_id: company._id,
        name: `${role === "admin" ? "Admin" : "Usuário"} ${tenant.name}`,
        email,
        passwordHash,
        role,
      });
      credentials.push({ company: tenant.name, email, password: PASSWORD, role });
    }

    // Products for this company are seeded here in the next task.
  }

  console.log("\nSeed complete. Login credentials:");
  console.table(credentials);
}

try {
  await seed();
} catch (err) {
  console.error("Seed failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
