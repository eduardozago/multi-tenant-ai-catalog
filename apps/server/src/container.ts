import { env } from "./config/env";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { PasswordHasher } from "./modules/auth/password";
import { TokenService } from "./modules/auth/token";
import { CompanyRepository } from "./modules/companies/company.repository";
import { UserRepository } from "./modules/users/user.repository";

/** Composition root: the only place that decides which implementation each layer gets. */
export function createContainer() {
  const companyRepository = new CompanyRepository();
  const userRepository = new UserRepository();

  const hasher = new PasswordHasher();
  const tokens = new TokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN);

  const authService = new AuthService(userRepository, companyRepository, hasher, tokens);

  return {
    tokens,
    authController: new AuthController(authService, tokens.ttlSeconds),
  };
}

export type Container = ReturnType<typeof createContainer>;
