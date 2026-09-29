#!/usr/bin/env node
// PostToolUse hook: formats the file Claude just edited with Biome.
// Never fails the tool call: formatting problems are reported by `pnpm check`.
import { execFileSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const file = JSON.parse(raw)?.tool_input?.file_path;
    if (!file || !/\.(ts|tsx|js|jsx|mjs|json|css)$/.test(file)) return;
    execFileSync("pnpm", ["exec", "biome", "check", "--write", file], {
      stdio: "ignore",
      cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    });
  } catch {
    // ignore
  }
});
