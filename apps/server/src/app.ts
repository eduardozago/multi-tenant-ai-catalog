import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { createContainer } from "./container";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createChatRouter } from "./modules/chat/chat.routes";
import type { LLMProvider } from "./modules/chat/llm/types";
import { createProductRouter } from "./modules/products/product.routes";
import { createUserRouter } from "./modules/users/user.routes";
import { getContext } from "./shared/context";
import { createAuthenticate } from "./shared/middlewares/authenticate";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error-handler";
import { createRateLimiter, type RateLimitOptions } from "./shared/middlewares/rate-limit";
import { requireJson } from "./shared/middlewares/require-json";

export type AppOptions = {
  /** Limit for register/login per IP. Tests raise it; one test lowers it to assert 429. */
  credentialsRateLimit?: RateLimitOptions;
  /** Chat requests per user. Tests raise it; one test lowers it to assert 429. */
  chatRateLimit?: RateLimitOptions;
  /** Replaces the OpenAI provider (tests use FakeLLMProvider). */
  llmProvider?: LLMProvider;
};

/** Builds the Express app without listening or connecting, so tests can use it directly. */
export function createApp(options: AppOptions = {}) {
  const container = createContainer({ llmProvider: options.llmProvider });
  const authenticate = createAuthenticate(container.tokens);
  const credentialsRateLimit = createRateLimiter(
    options.credentialsRateLimit ?? { windowMs: 60_000, limit: 10 },
  );

  // Per user, not per IP: each message costs LLM tokens, and users behind the same NAT
  // should not share a budget. Runs after authenticate, so the user is known.
  const chatRateLimit = createRateLimiter(
    options.chatRateLimit ?? { windowMs: 60_000, limit: 20 },
    (req) => getContext(req).userId,
  );

  const app = express();

  app.use(helmet());
  // Only the web app may make credentialed cross-origin calls.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(requireJson);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(
    "/auth",
    createAuthRouter({ controller: container.authController, authenticate, credentialsRateLimit }),
  );
  app.use("/users", createUserRouter({ controller: container.userController, authenticate }));
  app.use("/products", createProductRouter({ controller: container.productController, authenticate }));
  app.use("/chat", createChatRouter({ controller: container.chatController, authenticate, chatRateLimit }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
