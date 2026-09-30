import type { CookieOptions, Response } from "express";

import { env } from "../../config/env";

export const ACCESS_TOKEN_COOKIE = "access_token";

// httpOnly: JavaScript (and so an XSS payload) can never read the token.
// sameSite lax: not sent on cross-site POST/fetch, still sent on top-level navigation.
// secure only in production so it works over http://localhost in development.
const baseOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};

export function setAuthCookie(res: Response, token: string, ttlSeconds: number): void {
  // maxAge matches the JWT expiry, so the browser drops the cookie when the token dies.
  res.cookie(ACCESS_TOKEN_COOKIE, token, { ...baseOptions, maxAge: ttlSeconds * 1000 });
}

export function clearAuthCookie(res: Response): void {
  // Must use the same name, path and flags as when set, or the browser keeps it.
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
}
