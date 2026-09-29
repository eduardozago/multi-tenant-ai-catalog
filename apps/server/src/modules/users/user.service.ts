import type { RequestContext } from "../../shared/context";
import type { PasswordHasher } from "../auth/password";
import type { CreateUserInput } from "./user.schemas";
import type { User, UserRepository } from "./user.repository";

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  list(ctx: RequestContext): Promise<User[]> {
    return this.users.listByCompany(ctx.companyId);
  }

  /** Always creates in the caller's company. Duplicate email → 409 EMAIL_TAKEN (repository). */
  async create(ctx: RequestContext, input: CreateUserInput): Promise<User> {
    const passwordHash = await this.hasher.hash(input.password);
    return this.users.create(ctx.companyId, {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
  }
}
