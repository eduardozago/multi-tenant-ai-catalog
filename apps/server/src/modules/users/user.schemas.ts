import { z } from "zod";

import { ROLES } from "../../shared/context";
import { emailSchema, passwordSchema } from "../../shared/validation";

// No company_id: the tenant comes from req.auth. Unknown keys (including a
// company_id sent by the client) are stripped by z.object.
export const createUserBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof createUserBodySchema>;
