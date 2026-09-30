import { z } from "zod";

import { emailSchema, nameSchema, passwordSchema } from "@/features/auth/schemas";
import { ROLES } from "@/lib/permissions";

// Mirrors createUserBodySchema on the server. No company field: the tenant comes from the session.
export const createUserSchema = z.object({
  name: nameSchema("o nome"),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES, "Selecione um papel"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
