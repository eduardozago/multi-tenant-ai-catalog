import { type RequestHandler, Router } from "express";

import { authorize } from "../../shared/middlewares/authorize";
import { validate } from "../../shared/middlewares/validate";
import type { ProductController } from "./product.controller";
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productParamsSchema,
  updateProductBodySchema,
} from "./product.schemas";

type Deps = { controller: ProductController; authenticate: RequestHandler };

export function createProductRouter({ controller, authenticate }: Deps) {
  const router = Router();

  // Every role reads; only admins write. authorize runs before validate, so a
  // user gets 403 regardless of what the body contains.
  router.use(authenticate);

  router.get("/", validate({ query: listProductsQuerySchema }), controller.list);
  router.get("/:id", validate({ params: productParamsSchema }), controller.get);
  router.post("/", authorize("admin"), validate({ body: createProductBodySchema }), controller.create);
  router.patch(
    "/:id",
    authorize("admin"),
    validate({ params: productParamsSchema, body: updateProductBodySchema }),
    controller.update,
  );
  router.delete("/:id", authorize("admin"), validate({ params: productParamsSchema }), controller.delete);

  return router;
}
