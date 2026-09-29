import type { Role } from "@/lib/permissions";

/**
 * Accounts created by `pnpm --filter server seed` (credentials are public in the README).
 * Rendered only when VITE_SHOW_DEMO_ACCOUNTS is true, so evaluators can switch roles in one click.
 */
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS: { company: string; email: string; role: Role }[] = [
  { company: "Pet Feliz", email: "admin@petfeliz.test", role: "admin" },
  { company: "Pet Feliz", email: "user@petfeliz.test", role: "user" },
  { company: "Volt Eletrônicos", email: "admin@volt.test", role: "admin" },
  { company: "Volt Eletrônicos", email: "user@volt.test", role: "user" },
];
