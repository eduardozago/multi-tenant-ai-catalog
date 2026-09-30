import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Set before any module loads, so config/env.ts parses these instead of a .env file.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mongodb://replaced-by-memory-server",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGIN: "http://localhost:3001",
      // Never used: tests inject FakeLLMProvider. Present so env validation passes.
      OPENAI_API_KEY: "test-key-not-used",
      LLM_MODEL: "test-model",
    },
    setupFiles: ["./test/setup.ts"],
    // First run downloads the MongoDB binary.
    hookTimeout: 120_000,
  },
});
