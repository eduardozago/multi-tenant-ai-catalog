import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error-handler";
import { requireJson } from "./shared/middlewares/require-json";

/** Builds the Express app without listening or connecting, so tests can use it directly. */
export function createApp() {
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
