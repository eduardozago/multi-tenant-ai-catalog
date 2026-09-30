/**
 * Escapes every regex metacharacter so user input is matched literally.
 * Without it, `.*` would match everything and a pattern like `(a+)+$` could
 * trigger catastrophic backtracking on the database.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
