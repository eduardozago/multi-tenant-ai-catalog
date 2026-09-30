import { z } from "zod";

// varlock loads `.env` files into process.env at the entry point (see `.env.schema`).
// This module is the single typed source the app reads, and fails fast on invalid config.
// It does not import varlock itself, so tests can provide process.env directly.

const DURATION_UNITS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // "8h" style, converted to seconds so the token `exp` and the cookie `maxAge`
  // are derived from the same number.
  JWT_EXPIRES_IN: z
    .string()
    .default("8h")
    .transform((value, ctx) => {
      const match = /^(\d+)([smhd])$/.exec(value);
      if (!match) {
        ctx.addIssue({ code: "custom", message: 'Expected <number><s|m|h|d>, e.g. "8h"' });
        return z.NEVER;
      }
      return Number(match[1]) * DURATION_UNITS[match[2] as keyof typeof DURATION_UNITS];
    }),
  CORS_ORIGIN: z.url(),
  OPENAI_API_KEY: z.string().min(1),
  // No default model in code: the model is a deployment choice (cost, latency, quality).
  LLM_MODEL: z.string().min(1),
  // LLM calls per chat message; bounds cost and latency when the model keeps calling tools.
  AGENT_MAX_ITERATIONS: z.coerce.number().int().min(1).max(10).default(5),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Only variable names and messages are printed, never values.
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = loadEnv();
