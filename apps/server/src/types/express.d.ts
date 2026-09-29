export {};

declare global {
  namespace Express {
    interface Request {
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
