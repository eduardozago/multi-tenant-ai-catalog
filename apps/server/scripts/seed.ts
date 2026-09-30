// Idempotent: clears products, users and companies, then recreates two tenants
// with known credentials and a demo catalog each.
// Run from the repo root with: pnpm db:seed
import "varlock/auto-load";

import { createDb } from "@multi-tenant-ai-catalog/db";
import mongoose, { type Types } from "mongoose";

import { env } from "../src/config/env";
import { PasswordHasher } from "../src/modules/auth/password";
import { CompanyModel } from "../src/modules/companies/company.model";
import { ProductModel } from "../src/modules/products/product.model";
import { UserModel } from "../src/modules/users/user.model";
import type { Role } from "../src/shared/context";
import { BYPASS_TENANT_SCOPE } from "../src/shared/db/tenant-scoped.plugin";
import { imageUrlFor, PET_FELIZ_PRODUCTS, type SeedProduct, VOLT_PRODUCTS } from "./seed-products";

const PASSWORD = "password123";

// Two clearly different segments, so the AI agent's answers make cross-tenant leaks obvious.
const TENANTS: { name: string; slug: string; products: SeedProduct[] }[] = [
  { name: "Pet Feliz", slug: "petfeliz", products: PET_FELIZ_PRODUCTS },
  { name: "Volt Eletrônicos", slug: "volt", products: VOLT_PRODUCTS },
];

async function clear() {
  // Tenant-scope bypass #2 (the other is UserRepository.findByEmailAcrossTenants):
  // wiping every tenant's data is exactly what the seed is for.
  await ProductModel.deleteMany({}).setOptions({ [BYPASS_TENANT_SCOPE]: true });
  await UserModel.deleteMany({}).setOptions({ [BYPASS_TENANT_SCOPE]: true });
  await CompanyModel.deleteMany({});
}

async function seed() {
  await createDb(env);
  // Make the database indexes match the schemas before inserting (unique email, product
  // compound indexes). syncIndexes also drops stale ones: init() cannot replace an index
  // whose options changed, such as the collation added to { company_id, name }.
  await Promise.all([CompanyModel.syncIndexes(), UserModel.syncIndexes(), ProductModel.syncIndexes()]);
  await clear();

  const passwordHash = await new PasswordHasher().hash(PASSWORD);
  const credentials: { company: string; email: string; password: string; role: Role }[] = [];
  const catalog: { company: string; products: number; categories: number; withoutImage: number }[] = [];

  for (const tenant of TENANTS) {
    const company = await CompanyModel.create({ name: tenant.name });
    const userIds: Partial<Record<Role, Types.ObjectId>> = {};
    for (const role of ["admin", "user"] as const) {
      const email = `${role}@${tenant.slug}.test`;
      const user = await UserModel.create({
        company_id: company._id,
        name: `${role === "admin" ? "Admin" : "Usuário"} ${tenant.name}`,
        email,
        passwordHash,
        role,
      });
      userIds[role] = user._id;
      credentials.push({ company: tenant.name, email, password: PASSWORD, role });
    }

    // Explicit fields per product (no spreading); every product belongs to this company.
    await ProductModel.insertMany(
      tenant.products.map((product) => ({
        company_id: company._id,
        createdBy: userIds.admin,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        category: product.category,
        imageUrl: imageUrlFor(product),
      })),
    );

    // Counted back from the database (scoped query) rather than from the arrays above.
    const [products, categories, withoutImage] = await Promise.all([
      ProductModel.countDocuments({ company_id: company._id }),
      ProductModel.distinct("category", { company_id: company._id }),
      ProductModel.countDocuments({ company_id: company._id, imageUrl: { $exists: false } }),
    ]);
    catalog.push({ company: tenant.name, products, categories: categories.length, withoutImage });
  }

  console.log("\nSeed complete. Products per company:");
  console.table(catalog);
  console.log("Login credentials:");
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
