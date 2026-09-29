import { z } from "zod";

import { emailSchema, passwordSchema } from "../../shared/validation";

// No company id field: registration always creates a new company (D-06).
export const registerBodySchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginBodySchema = z.object({
  email: emailSchema,
  // Not passwordSchema: login must not reveal password rules, only right or wrong.
  password: z.string().min(1).max(1024),
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
