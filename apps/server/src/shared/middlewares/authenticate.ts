import type { RequestHandler } from "express";

import { ACCESS_TOKEN_COOKIE } from "../../modules/auth/cookie";
import type { TokenService } from "../../modules/auth/token";
import { UnauthorizedError } from "../errors";

/**
 * Reads the JWT from the httpOnly cookie, verifies it and sets `req.auth`.
 * This is the only place a tenant id enters a request.
 */
export function createAuthenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const token: unknown = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (typeof token !== "string" || token.length === 0) {
      throw new UnauthorizedError("UNAUTHENTICATED", "Authentication required");
    }
    req.auth = tokens.verify(token);
    next();
  };
}
