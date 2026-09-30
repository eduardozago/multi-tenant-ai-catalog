import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, NotFoundError } from "../errors";
import { logger } from "../logger";

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function body(code: string, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

/** Errors raised by Express/body-parser (malformed JSON, payload too large) carry a safe status. */
function isHttpClientError(err: unknown): err is { status: number; type?: string; message: string } {
  if (typeof err !== "object" || err === null) return false;
  const { status, expose } = err as { status?: unknown; expose?: unknown };
  return typeof status === "number" && status >= 400 && status < 500 && expose === true;
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError("NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    // 5xx AppErrors are upstream failures (LLM provider): the client gets the safe
    // message, the log gets the cause.
    if (err.status >= 500) {
      logger.error("app_error", { code: err.code, cause: err.cause instanceof Error ? err.cause.message : undefined });
    }
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    res.status(400).json(body("VALIDATION_ERROR", "Invalid request", details));
    return;
  }

  // Fallback for unique indexes not translated by a repository.
  if (isDuplicateKeyError(err)) {
    res.status(409).json(body("CONFLICT", "Resource already exists"));
    return;
  }

  if (isHttpClientError(err)) {
    const code = err.type === "entity.parse.failed" ? "INVALID_JSON" : "BAD_REQUEST";
    res.status(err.status).json(body(code, err.message));
    return;
  }

  // Unknown (including TenantScopeError): log the real error, return nothing internal.
  console.error(err);
  res.status(500).json(body("INTERNAL_ERROR", "Internal server error"));
};
