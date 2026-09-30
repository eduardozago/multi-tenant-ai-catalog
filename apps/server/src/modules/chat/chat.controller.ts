import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import { toErrorResponse } from "../../shared/middlewares/error-handler";
import type { AgentEvent } from "./chat.types";
import type { ConversationParams, SendMessageInput } from "./chat.schemas";
import type { ChatService } from "./chat.service";
import { openEventStream } from "./sse";

/** Agent event → SSE payload. tool_end repeats only what the UI needs, not the input. */
function toStreamEvent(event: AgentEvent): [string, unknown] {
  switch (event.type) {
    case "tool_start":
      return ["tool_start", { name: event.name, input: event.input }];
    case "tool_end":
      return [
        "tool_end",
        event.error === undefined
          ? { name: event.name, resultCount: event.resultCount }
          : { name: event.name, error: event.error },
      ];
    case "delta":
      return ["delta", { text: event.text }];
  }
}

export class ChatController {
  constructor(private readonly chat: ChatService) {}

  send = async (req: Request, res: Response) => {
    const result = await this.chat.send(getContext(req), req.validated.body as SendMessageInput);
    res.status(200).json(result);
  };

  /**
   * SSE version of send: meta → tool_start/tool_end → delta… → done | error.
   * Two service calls instead of one: prepare() runs while a JSON error (404, 400) is
   * still possible; once the stream is open the status is 200 and failures travel as
   * an `error` event with the same code and message the error handler would use.
   */
  stream = async (req: Request, res: Response) => {
    // Client disconnect (tab closed, fetch aborted) cancels the model call and the
    // loop; complete() then throws and nothing is stored. Registered before prepare()
    // so a client that leaves during it is not missed ("close" would already have
    // fired). "close" also fires after a normal end, which writableFinished tells apart.
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) abort.abort();
    });

    const turn = await this.chat.prepare(getContext(req), req.validated.body as SendMessageInput);

    const events = openEventStream(res);
    events.send("meta", { conversationId: turn.conversationId });
    try {
      const result = await this.chat.complete(turn, {
        stream: true,
        signal: abort.signal,
        onEvent: (event) => events.send(...toStreamEvent(event)),
      });
      events.send("done", { reply: result.reply, products: result.products, toolCalls: result.toolCalls });
    } catch (error) {
      if (!abort.signal.aborted) {
        const { body } = toErrorResponse(error);
        events.send("error", { code: body.error.code, message: body.error.message });
      }
    } finally {
      events.end();
    }
  };

  listConversations = async (req: Request, res: Response) => {
    const conversations = await this.chat.listConversations(getContext(req));
    res.status(200).json({ conversations });
  };

  getConversation = async (req: Request, res: Response) => {
    const { id } = req.validated.params as ConversationParams;
    const conversation = await this.chat.getConversation(getContext(req), id);
    // Listed field by field: no company_id or userId in the response.
    res.status(200).json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        messages: conversation.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  };
}
