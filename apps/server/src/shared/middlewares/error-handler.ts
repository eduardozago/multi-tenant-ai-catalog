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

export type ErrorResponse = { status: number; body: ErrorBody };

/**
 * The single mapping from any thrown value to status + `{ error: { code, message, details? } }`.
 * Used by the HTTP error handler and by the chat SSE stream, whose `error` event
 * carries the same code and message a JSON response would.
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) {
    // 5xx AppErrors are upstream failures (LLM provider): the client gets the safe
    // message, the log gets the cause.
    if (err.status >= 500) {
      logger.error("app_error", { code: err.code, cause: err.cause instanceof Error ? err.cause.message : undefined });
    }
    return { status: err.status, body: body(err.code, err.message, err.details) };
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { status: 400, body: body("VALIDATION_ERROR", "Invalid request", details) };
  }

  // Fallback for unique indexes not translated by a repository.
  if (isDuplicateKeyError(err)) {
    return { status: 409, body: body("CONFLICT", "Resource already exists") };
  }

  if (isHttpClientError(err)) {
    const code = err.type === "entity.parse.failed" ? "INVALID_JSON" : "BAD_REQUEST";
    return { status: err.status, body: body(code, err.message) };
  }

  // Unknown (including TenantScopeError): log what is needed to debug, return nothing
  // internal. Not the whole object: Mongoose validation/cast errors carry the offending
  // values (which can be a chat message) in their `errors`/`value` fields.
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error("unhandled_error", { name: error.name, message: error.message, stack: error.stack });
  return { status: 500, body: body("INTERNAL_ERROR", "Internal server error") };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
};
