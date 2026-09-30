import { type RequestHandler, Router } from "express";

import { authorize } from "../../shared/middlewares/authorize";
import { validate } from "../../shared/middlewares/validate";
import type { UserController } from "./user.controller";
import { createUserBodySchema } from "./user.schemas";

type Deps = { controller: UserController; authenticate: RequestHandler };

export function createUserRouter({ controller, authenticate }: Deps) {
  const router = Router();

  // User management is admin-only for every route in this module.
  router.use(authenticate, authorize("admin"));

  router.get("/", controller.list);
  router.post("/", validate({ body: createUserBodySchema }), controller.create);

  return router;
}
