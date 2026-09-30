import { env } from "../config/env";

type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

/**
 * Structured logger: one JSON line per event, ready for any log collector. Callers pass
 * metadata (ids, counts, durations), never message content, tokens or passwords.
 * Silent under test so the runner output stays readable; tests spy on the methods.
 */
function write(level: Level, event: string, fields: Fields) {
  if (env.NODE_ENV === "test") return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "info") console.log(line);
  else console.error(line);
}

export const logger = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  error: (event: string, fields: Fields = {}) => write("error", event, fields),
};
