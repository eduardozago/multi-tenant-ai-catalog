import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

import { AppError } from "../errors";

export type RateLimitOptions = { windowMs: number; limit: number };

/**
 * In-memory limiter: fine for a single instance. By default it is per IP, for
 * credential endpoints (brute force, account creation spam); behind a proxy,
 * `trust proxy` must be configured so the client IP is used instead of the proxy's.
 * `keyGenerator` swaps the IP for another key, e.g. the authenticated user.
 */
export function createRateLimiter(
  { windowMs, limit }: RateLimitOptions,
  keyGenerator?: (req: Request) => string,
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    // Route through the central error handler so 429 has the standard error shape.
    handler: (_req, _res, next) => {
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many requests, try again later"));
    },
  });
}
