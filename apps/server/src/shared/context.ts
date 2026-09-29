import type { Request } from "express";

import { UnauthorizedError } from "./errors";

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

/** Who is making the request. Built only from the verified JWT. */
export type RequestContext = {
  userId: string;
  companyId: string;
  role: Role;
};

/**
 * Returns the authenticated context. Throws instead of returning undefined so a
 * route that forgot `authenticate` fails closed (401) rather than running without a tenant.
 */
export function getContext(req: Request): RequestContext {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}
