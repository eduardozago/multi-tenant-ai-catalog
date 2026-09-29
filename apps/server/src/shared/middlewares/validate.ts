import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type Schemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

/**
 * Parses the given request parts with zod and stores the result in `req.validated`.
 * Unknown keys are stripped by the (non-strict) object schemas, so a `company_id`
 * in the body never reaches the controller. A ZodError is forwarded to the error
 * handler, which renders it as 400 VALIDATION_ERROR.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const validated: Express.Request["validated"] = {};
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (schema) validated[part] = schema.parse(req[part]);
    }
    req.validated = validated;
    next();
  };
}
