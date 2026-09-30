import { ConflictError } from "../../shared/errors";
import type { Role } from "../../shared/context";
import { BYPASS_TENANT_SCOPE } from "../../shared/db/tenant-scoped.plugin";
import { type UserDocument, UserModel } from "./user.model";

export type User = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

/** Only used by AuthService to verify a password; never mapped into a response. */
export type UserCredentials = { user: User; passwordHash: string };

export type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
};

function toUser(doc: Omit<UserDocument, "passwordHash">): User {
  return {
    id: doc._id.toString(),
    companyId: doc.company_id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt,
  };
}

function isDuplicateEmail(err: unknown): boolean {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && e.keyPattern?.email !== undefined;
}

export class UserRepository {
  /**
   * The one tenant-scope bypass in the application code. Login receives only an
   * email, so the tenant is unknown until the user is found; registration uses the
   * same lookup to enforce global email uniqueness. Returns the password hash so
   * the auth service can verify it.
   */
  async findByEmailAcrossTenants(email: string): Promise<UserCredentials | null> {
    const doc = await UserModel.findOne({ email })
      .select("+passwordHash")
      .setOptions({ [BYPASS_TENANT_SCOPE]: true })
      .lean();
    return doc ? { user: toUser(doc), passwordHash: doc.passwordHash } : null;
  }

  async findById(companyId: string, userId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ _id: userId, company_id: companyId }).lean();
    return doc ? toUser(doc) : null;
  }

  async listByCompany(companyId: string): Promise<User[]> {
    const docs = await UserModel.find({ company_id: companyId }).sort({ createdAt: 1 }).lean();
    return docs.map(toUser);
  }

  async create(companyId: string, input: NewUser): Promise<User> {
    try {
      // company_id is set explicitly from the argument, never spread from input.
      const doc = await UserModel.create({
        company_id: companyId,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
      });
      return toUser(doc.toObject());
    } catch (err) {
      // Also covers the race where two requests pass a uniqueness pre-check.
      if (isDuplicateEmail(err)) throw new ConflictError("EMAIL_TAKEN", "Email is already in use");
      throw err;
    }
  }
}
