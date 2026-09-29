import { type RequestHandler, Router } from "express";

import { validate } from "../../shared/middlewares/validate";
import type { AuthController } from "./auth.controller";
import { loginBodySchema, registerBodySchema } from "./auth.schemas";

type Deps = {
  controller: AuthController;
  authenticate: RequestHandler;
  credentialsRateLimit: RequestHandler;
};

export function createAuthRouter({ controller, authenticate, credentialsRateLimit }: Deps) {
  const router = Router();

  router.post(
    "/register",
    credentialsRateLimit,
    validate({ body: registerBodySchema }),
    controller.register,
  );
  router.post("/login", credentialsRateLimit, validate({ body: loginBodySchema }), controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", authenticate, controller.me);

  return router;
}
