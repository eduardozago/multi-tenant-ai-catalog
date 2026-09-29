import type { RequestContext } from "../shared/context";

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` from the verified JWT. Read it through `getContext(req)`. */
      auth?: RequestContext;
      /**
       * Parsed output of `validate()`. Express 5 makes `req.query` a getter, so parsed
       * (coerced, stripped) input lives here instead of overwriting the raw request.
       */
      validated: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}
