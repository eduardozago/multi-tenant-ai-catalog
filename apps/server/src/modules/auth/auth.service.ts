import type { RequestContext } from "../../shared/context";
import { ConflictError, UnauthorizedError } from "../../shared/errors";
import type { CompanyRepository } from "../companies/company.repository";
import type { User, UserRepository } from "../users/user.repository";
import type { LoginInput, RegisterInput } from "./auth.schemas";
import type { PasswordHasher } from "./password";
import type { TokenService } from "./token";
import { type AuthUserDto, toAuthUserDto } from "./user.dto";

export type AuthResult = { user: AuthUserDto; token: string };

const invalidCredentials = () =>
  new UnauthorizedError("INVALID_CREDENTIALS", "Invalid email or password");

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly companies: CompanyRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Creates a company and its first admin. Without a replica set there are no
   * transactions, so a failed user insert is compensated by deleting the company (D-10).
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    if (await this.users.findByEmailAcrossTenants(input.email)) {
      throw new ConflictError("EMAIL_TAKEN", "Email is already in use");
    }
    // Hash before creating anything, so a hashing failure needs no compensation.
    const passwordHash = await this.hasher.hash(input.password);

    const company = await this.companies.create(input.companyName);
    let user: User;
    try {
      user = await this.users.create(company.id, {
        name: input.name,
        email: input.email,
        passwordHash,
        role: "admin",
      });
    } catch (err) {
      // Log a failed compensation but rethrow the original cause.
      await this.companies.deleteById(company.id).catch((cleanupErr) => {
        console.error("Register compensation failed; orphan company", company.id, cleanupErr);
      });
      throw err;
    }

    return { user: toAuthUserDto(user, company), token: this.issueToken(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const credentials = await this.users.findByEmailAcrossTenants(input.email);
    // Same error and same bcrypt cost whether the email exists or not.
    const valid = credentials
      ? await this.hasher.compare(input.password, credentials.passwordHash)
      : await this.hasher.compareAgainstDummy(input.password);
    if (!credentials || !valid) throw invalidCredentials();

    const { user } = credentials;
    const company = await this.companies.findById(user.companyId);
    if (!company) throw invalidCredentials();

    return { user: toAuthUserDto(user, company), token: this.issueToken(user) };
  }

  /** Reloads the user so a deleted user's still-valid token stops working here. */
  async me(ctx: RequestContext): Promise<AuthUserDto> {
    const user = await this.users.findById(ctx.companyId, ctx.userId);
    const company = user && (await this.companies.findById(ctx.companyId));
    if (!user || !company) throw new UnauthorizedError("UNAUTHENTICATED", "User no longer exists");
    return toAuthUserDto(user, company);
  }

  private issueToken(user: User): string {
    return this.tokens.sign({ userId: user.id, companyId: user.companyId, role: user.role });
  }
}
