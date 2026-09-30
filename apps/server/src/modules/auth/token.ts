import jwt from "jsonwebtoken";
import { z } from "zod";

import { ROLES, type RequestContext } from "../../shared/context";
import { UnauthorizedError } from "../../shared/errors";
import { objectIdSchema } from "../../shared/validation";

const ALGORITHM = "HS256";

// A validly signed token must still have the expected shape before it becomes req.auth.
const payloadSchema = z.object({
  sub: objectIdSchema,
  companyId: objectIdSchema,
  role: z.enum(ROLES),
});

export class TokenService {
  constructor(
    private readonly secret: string,
    readonly ttlSeconds: number,
  ) {}

  sign(ctx: RequestContext): string {
    return jwt.sign({ companyId: ctx.companyId, role: ctx.role }, this.secret, {
      algorithm: ALGORITHM,
      subject: ctx.userId,
      expiresIn: this.ttlSeconds,
    });
  }

  /**
   * Pinning `algorithms` rejects `alg: none` and algorithm-confusion tokens.
   * Any failure (bad signature, expired, malformed, wrong shape) is the same 401.
   */
  verify(token: string): RequestContext {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
    } catch {
      throw new UnauthorizedError("INVALID_TOKEN", "Invalid or expired token");
    }
    const parsed = payloadSchema.safeParse(decoded);
    if (!parsed.success) throw new UnauthorizedError("INVALID_TOKEN", "Invalid or expired token");
    return { userId: parsed.data.sub, companyId: parsed.data.companyId, role: parsed.data.role };
  }
}
