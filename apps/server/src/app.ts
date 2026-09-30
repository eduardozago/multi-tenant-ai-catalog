import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { createContainer } from "./container";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createProductRouter } from "./modules/products/product.routes";
import { createUserRouter } from "./modules/users/user.routes";
import { createAuthenticate } from "./shared/middlewares/authenticate";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error-handler";
import { createRateLimiter, type RateLimitOptions } from "./shared/middlewares/rate-limit";
import { requireJson } from "./shared/middlewares/require-json";

export type AppOptions = {
  /** Limit for register/login per IP. Tests raise it; one test lowers it to assert 429. */
  credentialsRateLimit?: RateLimitOptions;
};

/** Builds the Express app without listening or connecting, so tests can use it directly. */
export function createApp(options: AppOptions = {}) {
  const container = createContainer();
  const authenticate = createAuthenticate(container.tokens);
  const credentialsRateLimit = createRateLimiter(
    options.credentialsRateLimit ?? { windowMs: 60_000, limit: 10 },
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
