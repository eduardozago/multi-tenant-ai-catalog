import { rateLimit } from "express-rate-limit";

import { AppError } from "../errors";

export type RateLimitOptions = { windowMs: number; limit: number };

/**
 * Per-IP limiter for credential endpoints (brute force, account creation spam).
 * In-memory store: fine for a single instance. Behind a proxy, `trust proxy`
 * must be configured so the client IP is used instead of the proxy's.
 */
export function createRateLimiter({ windowMs, limit }: RateLimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Route through the central error handler so 429 has the standard error shape.
    handler: (_req, _res, next) => {
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many requests, try again later"));
    },
  });
}
