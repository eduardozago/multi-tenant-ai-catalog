import { env } from "./config/env";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { PasswordHasher } from "./modules/auth/password";
import { TokenService } from "./modules/auth/token";
import { CompanyRepository } from "./modules/companies/company.repository";
import { UserController } from "./modules/users/user.controller";
import { UserRepository } from "./modules/users/user.repository";
import { UserService } from "./modules/users/user.service";

/** Composition root: the only place that decides which implementation each layer gets. */
export function createContainer() {
  const companyRepository = new CompanyRepository();
  const userRepository = new UserRepository();

  const hasher = new PasswordHasher();
  const tokens = new TokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN);

  const authService = new AuthService(userRepository, companyRepository, hasher, tokens);
  const userService = new UserService(userRepository, hasher);

  return {
    tokens,
    authController: new AuthController(authService, tokens.ttlSeconds),
    userController: new UserController(userService),
  };
}

export type Container = ReturnType<typeof createContainer>;
