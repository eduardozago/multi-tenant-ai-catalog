import { ENV } from "@/env";

/** Normalized form of the server error body `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** One entry of `details` on a server VALIDATION_ERROR. */
export type ValidationIssue = { path: string; message: string };

export function getValidationIssues(error: ApiError): ValidationIssue[] {
  if (error.code !== "VALIDATION_ERROR" || !Array.isArray(error.details)) return [];
  return error.details.filter(
    (item): item is ValidationIssue =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ValidationIssue).path === "string" &&
      typeof (item as ValidationIssue).message === "string",
  );
}

// A 401 on these is an expected answer (wrong password, no session yet),
// not an expired session, so it must not trigger the global logout redirect.
const SESSION_ENDPOINTS = new Set(["/auth/login", "/auth/register", "/auth/me"]);

let onUnauthorized: (() => void) | undefined;

/**
 * Registered once in main.tsx. Keeps this module free of router and query
 * client imports (both of which depend on the API layer).
 */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function parseError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const error = (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } })
    ?.error;
  if (error && typeof error.code === "string" && typeof error.message === "string") {
    return new ApiError(response.status, error.code, error.message, error.details);
  }
  return new ApiError(response.status, "UNKNOWN_ERROR", response.statusText || "Request failed");
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: HeadersInit = {};
  // The server rejects non-JSON writes with 415 (CSRF protection), even when there is no body.
  if (method !== "GET") headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${ENV.VITE_SERVER_URL}${path}`, {
      method,
      headers,
      // The session is an httpOnly cookie: the browser attaches it, this code never sees it.
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor");
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401 && !SESSION_ENDPOINTS.has(path)) onUnauthorized?.();
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
