import type { RequestHandler } from "express";

import { AppError } from "../errors";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * CSRF hardening for cookie auth: state-changing requests must declare
 * `Content-Type: application/json`, even when they have no body (logout).
 * Browsers can only send text/plain, form-urlencoded or multipart cross-site without
 * a CORS preflight; JSON forces the preflight, which our CORS policy rejects for
 * any origin other than the web app. DELETE always preflights cross-origin.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!METHODS_WITH_BODY.has(req.method)) return next();

  const mediaType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }
  next();
};
