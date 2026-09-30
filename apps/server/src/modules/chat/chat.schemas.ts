import { z } from "zod";

import { objectIdSchema } from "../../shared/validation";

export const MAX_MESSAGE_LENGTH = 2000;

// Only the user's text and, optionally, which of their conversations to continue.
// History, assistant and tool messages are never accepted from the client (D-29).
export const sendMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  conversationId: objectIdSchema.optional(),
});

export const conversationParamsSchema = z.object({ id: objectIdSchema });

export type SendMessageInput = z.infer<typeof sendMessageBodySchema>;
export type ConversationParams = z.infer<typeof conversationParamsSchema>;
