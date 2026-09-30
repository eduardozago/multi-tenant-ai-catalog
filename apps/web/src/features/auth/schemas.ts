import { z } from "zod";

// Mirrors apps/server/src/shared/validation.ts and auth.schemas.ts. The server
// validates again; these rules exist so the user sees the problem before submitting.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe o email")
  .pipe(z.email("Email inválido"));

// bcrypt reads only the first 72 bytes, so the server caps by bytes, not characters.
export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "A senha deve ter no máximo 72 bytes",
  );

export const nameSchema = (label: string) =>
  z.string().trim().min(1, `Informe ${label}`).max(120, "Máximo de 120 caracteres");

export const loginSchema = z.object({
  email: emailSchema,
  // Login does not reveal password rules: only "right or wrong", as on the server.
  password: z.string().min(1, "Informe a senha"),
});

export const registerSchema = z
  .object({
    companyName: nameSchema("o nome da empresa"),
    name: nameSchema("seu nome"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterFormInput = z.infer<typeof registerSchema>;
export type RegisterInput = Omit<RegisterFormInput, "confirmPassword">;
