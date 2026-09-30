import { describe, expect, it } from "vitest";

import { AuthService } from "../src/modules/auth/auth.service";
import { PasswordHasher } from "../src/modules/auth/password";
import { TokenService } from "../src/modules/auth/token";
import { CompanyModel } from "../src/modules/companies/company.model";
import { CompanyRepository } from "../src/modules/companies/company.repository";
import { UserRepository } from "../src/modules/users/user.repository";

// No transactions without a replica set: a failed user insert must delete the company (D-10).
describe("AuthService.register compensation", () => {
  it("deletes the new company and rethrows when creating the admin fails", async () => {
    const failure = new Error("insert failed");
    const users = new UserRepository();
    users.create = async () => {
      throw failure;
    };
    const auth = new AuthService(
      users,
      new CompanyRepository(),
      new PasswordHasher(),
      new TokenService(process.env.JWT_SECRET!, 60),
    );

    await expect(
      auth.register({ companyName: "Acme", name: "Ana", email: "ana@acme.test", password: "password123" }),
    ).rejects.toBe(failure);
    expect(await CompanyModel.countDocuments()).toBe(0);
  });
});
