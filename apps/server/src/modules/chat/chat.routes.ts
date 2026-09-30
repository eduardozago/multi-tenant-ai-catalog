import { type RequestHandler, Router } from "express";

import { authorize } from "../../shared/middlewares/authorize";
import { validate } from "../../shared/middlewares/validate";
import type { ChatController } from "./chat.controller";
import { conversationParamsSchema, sendMessageBodySchema } from "./chat.schemas";

type Deps = {
  controller: ChatController;
  authenticate: RequestHandler;
  /** Per-user limiter for the routes that call the LLM. */
  chatRateLimit: RequestHandler;
};

export function createChatRouter({ controller, authenticate, chatRateLimit }: Deps) {
  const router = Router();

  // chat:use: every role. Listed explicitly so a future role does not get the chat by default.
  router.use(authenticate, authorize("admin", "user"));

  router.post("/", chatRateLimit, validate({ body: sendMessageBodySchema }), controller.send);
  // Same guards and body; errors raised by this chain are still plain JSON responses.
  router.post("/stream", chatRateLimit, validate({ body: sendMessageBodySchema }), controller.stream);
  router.get("/conversations", controller.listConversations);
  router.get("/conversations/:id", validate({ params: conversationParamsSchema }), controller.getConversation);

  return router;
}
