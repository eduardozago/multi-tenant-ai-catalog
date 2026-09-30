import { z } from "zod";

import type { Product } from "@/features/products/api";
import { ApiError, apiFetch } from "@/lib/api-client";
import { streamEvents } from "@/lib/sse";

/** Mirrors MAX_MESSAGE_LENGTH in apps/server/src/modules/chat/chat.schemas.ts. */
export const MAX_MESSAGE_LENGTH = 2000;

/** Mirrors ToolCallSummary in apps/server/src/modules/chat/chat.types.ts. */
export type ToolCallSummary = {
  name: string;
  /** Input as validated by the server's zod schema; null when the model sent an invalid one. */
  input: unknown;
  resultCount?: number;
  error?: string;
};

/** Mirrors StoredMessage in apps/server/src/modules/chat/conversation.model.ts (dates as ISO strings). */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallSummary[];
  /** Snapshot taken when the answer was written; the detail sheet refetches the live product. */
  products?: Product[];
  createdAt: string;
};

export type ConversationSummary = { id: string; title: string; updatedAt: string };

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type SendMessageInput = { message: string; conversationId?: string };

export async function listConversations(signal?: AbortSignal): Promise<ConversationSummary[]> {
  const { conversations } = await apiFetch<{ conversations: ConversationSummary[] }>("/chat/conversations", {
    signal,
  });
  return conversations;
}

export async function getConversation(id: string, signal?: AbortSignal): Promise<Conversation> {
  const { conversation } = await apiFetch<{ conversation: Conversation }>(
    `/chat/conversations/${encodeURIComponent(id)}`,
    { signal },
  );
  return conversation;
}

// Payloads of POST /chat/stream (ChatController.stream on the server). The stream is
// external input, so each payload is checked before the UI trusts its shape. Products
// are the server's ProductDto, checked only as objects: they are rendered, never trusted
// for anything else.
const toolCallSchema = z.object({
  name: z.string(),
  input: z.unknown(),
  resultCount: z.number().optional(),
  error: z.string().optional(),
});

const streamPayloadSchemas = {
  meta: z.object({ conversationId: z.string() }),
  tool_start: z.object({ name: z.string(), input: z.unknown() }),
  tool_end: z.object({ name: z.string(), resultCount: z.number().optional(), error: z.string().optional() }),
  delta: z.object({ text: z.string() }),
  done: z.object({
    reply: z.string(),
    products: z.array(z.custom<Product>((value) => typeof value === "object" && value !== null)),
    toolCalls: z.array(toolCallSchema),
  }),
  error: z.object({ code: z.string(), message: z.string() }),
};

type StreamPayloads = { [K in keyof typeof streamPayloadSchemas]: z.infer<(typeof streamPayloadSchemas)[K]> };

/**
 * One event of the answer stream: meta → (tool_start | tool_end | delta)* → done | error.
 * The server's `error` event is not in this union: it is thrown as an ApiError, so the
 * caller handles stream failures and request failures in one place.
 */
export type ChatStreamEvent = {
  [K in Exclude<keyof StreamPayloads, "error">]: { type: K } & StreamPayloads[K];
}[Exclude<keyof StreamPayloads, "error">];

function isKnownEvent(name: string): name is keyof typeof streamPayloadSchemas {
  return Object.hasOwn(streamPayloadSchemas, name);
}

function invalidStream(): ApiError {
  return new ApiError(200, "INVALID_STREAM", "Malformed chat stream event");
}

export async function* streamChat(input: SendMessageInput, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  for await (const { event, data } of streamEvents("/chat/stream", { body: input, signal })) {
    // Unknown names are skipped, so the server can add events without breaking this client.
    if (!isKnownEvent(event)) continue;

    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      throw invalidStream();
    }
    const parsed = streamPayloadSchemas[event].safeParse(json);
    if (!parsed.success) throw invalidStream();

    if (event === "error") {
      const { code, message } = parsed.data as StreamPayloads["error"];
      // The HTTP status was already 200 when this failure happened (D-30); the code is
      // the one the error handler would have used (LLM_UNAVAILABLE, AGENT_ITERATION_LIMIT, ...).
      throw new ApiError(200, code, message);
    }
    yield { type: event, ...parsed.data } as ChatStreamEvent;
  }
}
