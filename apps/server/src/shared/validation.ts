import { z } from "zod";

/** Validated before reaching Mongo so a malformed id is a 400, not a CastError 500. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// bcrypt only uses the first 72 bytes; longer passwords would be silently truncated.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes");
