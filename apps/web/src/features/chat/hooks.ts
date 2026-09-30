import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { ApiError } from "@/lib/api-client";

import {
  type ChatMessage,
  type Conversation,
  type ChatStreamEvent,
  getConversation,
  listConversations,
  streamChat,
} from "./api";

export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => ["chat", "conversations"] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: ({ signal }) => listConversations(signal),
  });
}

/** `id: null` (a new conversation) disables the query. */
export function useConversation(id: string | null) {
  return useQuery({
    queryKey: chatKeys.conversation(id ?? ""),
    queryFn: ({ signal }) => getConversation(id as string, signal),
    enabled: id !== null,
  });
}

// ---------------------------------------------------------------------------
// In-flight exchange
// ---------------------------------------------------------------------------

/** One tool call as it happens. The server's tool_end carries no input, only the name. */
export type ToolActivity = {
  name: string;
  input: unknown;
  status: "running" | "done" | "error";
  resultCount?: number;
  error?: string;
};

/**
 * The exchange that is not in the conversation cache yet. `idle` means there is none:
 * every completed answer lives in the cache (the server stored it). `error` and
 * `stopped` keep the question and the partial answer on screen, because the server
 * stored nothing for them (D-29) and the user may want to retry.
 */
export type ChatStreamState = {
  status: "idle" | "streaming" | "error" | "stopped";
  /** The question being answered; null when idle. */
  message: string | null;
  /** Text streamed so far. Not authoritative: `done.reply` replaces it (D-30). */
  text: string;
  tools: ToolActivity[];
  error: unknown;
};

type Action =
  | { type: "start"; message: string }
  | { type: "event"; event: Exclude<ChatStreamEvent, { type: "meta" | "done" }> }
  | { type: "failed"; error: unknown }
  | { type: "stopped" }
  | { type: "reset" };

const idleState: ChatStreamState = { status: "idle", message: null, text: "", tools: [], error: null };

function reducer(state: ChatStreamState, action: Action): ChatStreamState {
  switch (action.type) {
    case "start":
      return { ...idleState, status: "streaming", message: action.message };
    case "event": {
      const { event } = action;
      if (event.type === "delta") return { ...state, text: state.text + event.text };
      if (event.type === "tool_start") {
        return { ...state, tools: [...state.tools, { name: event.name, input: event.input, status: "running" }] };
      }
      // tool_end has no call id: it closes the oldest running call with the same name.
      // Calls of one turn run in parallel, but only the count per name matters to the UI,
      // and done.toolCalls replaces this list with the authoritative one anyway.
      const index = state.tools.findIndex((tool) => tool.name === event.name && tool.status === "running");
      if (index === -1) return state;
      const tools = state.tools.slice();
      tools[index] = {
        ...tools[index],
        status: event.error === undefined ? "done" : "error",
        resultCount: event.resultCount,
        error: event.error,
      };
      return { ...state, tools };
    }
    case "failed":
      return { ...state, status: "error", error: action.error, tools: settle(state.tools) };
    case "stopped":
      return { ...state, status: "stopped", tools: settle(state.tools) };
    case "reset":
      return idleState;
  }
}

/** A call still running when the answer failed or stopped will never get its tool_end. */
function settle(tools: ToolActivity[]): ToolActivity[] {
  return tools.map((tool) => (tool.status === "running" ? { ...tool, status: "error" } : tool));
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Sends a message through POST /chat/stream and tracks the answer while it streams.
 *
 * `conversationId` is the conversation on screen, and only ever an id the server has
 * stored (from the URL or from a finished answer). The `meta` id of a new conversation
 * is never reused on retry: nothing is stored until `done`, so that id would be a 404.
 *
 * On `done` the exchange is written into the ['chat', 'conversation', id] cache and the
 * state goes back to idle, so the finished answer renders from the same source as a
 * conversation loaded from history. `send` resolves with the conversation id on success
 * (the page puts a new one in the URL) and null otherwise.
 *
 * Changing `conversationId` or unmounting aborts the request, which also cancels the
 * model call on the server.
 */
export function useChatStream(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, idleState);
  // The request in flight. Compared by identity, so a request that was superseded
  // (conversation switched) can never dispatch into the state of the next one.
  const activeRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRef.current?.abort();
      activeRef.current = null;
      dispatch({ type: "reset" });
    };
  }, [conversationId]);

  const commit = useCallback(
    (id: string, isNew: boolean, message: string, reply: ChatMessage) => {
      const question: ChatMessage = { role: "user", content: message, createdAt: new Date().toISOString() };
      const key = chatKeys.conversation(id);
      if (queryClient.getQueryData<Conversation>(key)) {
        queryClient.setQueryData<Conversation>(key, (current) =>
          current && { ...current, messages: [...current.messages, question, reply], updatedAt: reply.createdAt },
        );
      } else if (isNew) {
        // Seeded so it renders at once when it enters the URL. The title approximates the
        // server's rule; the conversation list refetch below shows the real one.
        queryClient.setQueryData<Conversation>(key, {
          id,
          title: message.replace(/\s+/g, " ").trim().slice(0, 60),
          messages: [question, reply],
          createdAt: question.createdAt,
          updatedAt: reply.createdAt,
        });
      } else {
        // An existing conversation whose messages are not cached: seeding would show only
        // this exchange as if it were the whole history. Fetch the stored one instead.
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
    [queryClient],
  );

  const send = useCallback(
    async (message: string): Promise<string | null> => {
      // One exchange at a time; the composer is disabled meanwhile, this is the backstop.
      if (activeRef.current) return null;
      const controller = new AbortController();
      activeRef.current = controller;
      const isCurrent = () => activeRef.current === controller;

      dispatch({ type: "start", message });
      let createdId: string | null = null;
      try {
        const events = streamChat({ message, conversationId: conversationId ?? undefined }, controller.signal);
        for await (const event of events) {
          if (!isCurrent()) return null;
          if (event.type === "meta") {
            createdId = event.conversationId;
          } else if (event.type === "done") {
            const id = conversationId ?? createdId;
            if (!id) throw new ApiError(200, "INVALID_STREAM", "done arrived without a conversation id");
            commit(id, conversationId === null, message, {
              role: "assistant",
              content: event.reply,
              toolCalls: event.toolCalls,
              products: event.products,
              createdAt: new Date().toISOString(),
            });
            activeRef.current = null;
            dispatch({ type: "reset" });
            return id;
          } else {
            dispatch({ type: "event", event });
          }
        }
        // Closed without done or error: the server went away mid-answer.
        throw new ApiError(0, "STREAM_INTERRUPTED", "The stream ended before the answer was complete");
      } catch (error) {
        if (!isCurrent()) return null;
        activeRef.current = null;
        if (isAbort(error)) dispatch({ type: "stopped" });
        else dispatch({ type: "failed", error });
        return null;
      }
    },
    [conversationId, commit],
  );

  /** Stops the answer; the server discards it (nothing is stored). */
  const stop = useCallback(() => activeRef.current?.abort(), []);

  /** Sends the failed or stopped question again, in the same conversation. */
  const retry = useCallback(
    () => (state.message !== null && state.status !== "streaming" ? send(state.message) : Promise.resolve(null)),
    [send, state.message, state.status],
  );

  return { state, send, stop, retry };
}
