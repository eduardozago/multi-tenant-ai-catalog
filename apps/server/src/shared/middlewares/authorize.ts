import type { RequestHandler } from "express";

import { getContext, type Role } from "../context";
import { ForbiddenError } from "../errors";

/** Role guard. Must run after `authenticate`; without it `getContext` fails closed with 401. */
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getContext(req);
    if (!roles.includes(role)) throw new ForbiddenError();
    next();
  };
}
