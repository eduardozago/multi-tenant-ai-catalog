import type { RequestContext } from "../../shared/context";
import { NotFoundError } from "../../shared/errors";
import type { CompanyRepository } from "../companies/company.repository";
import type { ProductDto } from "../products/product.dto";
import type { AgentEvent, AgentService, ToolCallSummary } from "./agent.service";
import type { StoredMessage } from "./conversation.model";
import type { Conversation, ConversationRepository, ConversationSummary } from "./conversation.repository";
import type { SendMessageInput } from "./chat.schemas";
import type { Message } from "./llm/types";

/** Messages of the conversation sent to the model with each new question. */
export const HISTORY_MESSAGES = 10;
const TITLE_LENGTH = 60;

export type ChatReply = {
  conversationId: string;
  reply: string;
  products: ProductDto[];
  toolCalls: ToolCallSummary[];
};

export type SendOptions = {
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  /** Stream the model's text as `delta` events. */
  stream?: boolean;
};

/** A message ready to run: ownership checked, conversation id fixed. */
export type PreparedTurn = {
  ctx: RequestContext;
  message: string;
  companyName: string;
  conversationId: string;
  /** Null for a new conversation, created when the first answer completes. */
  existing: Conversation | null;
};

const conversationNotFound = () => new NotFoundError("CONVERSATION_NOT_FOUND", "Conversation not found");

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length <= TITLE_LENGTH ? oneLine : `${oneLine.slice(0, TITLE_LENGTH - 1).trimEnd()}…`;
}

/**
 * Only the text of earlier turns goes back to the model. Tool calls and results of
 * past answers are not replayed: the model queries again when it needs fresh data,
 * and old prices never compete with current ones.
 */
function toHistory(messages: StoredMessage[]): Message[] {
  return messages
    .slice(-HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, content: [{ type: "text" as const, text: message.content }] }));
}

export class ChatService {
  constructor(
    private readonly agent: AgentService,
    private readonly conversations: ConversationRepository,
    private readonly companies: CompanyRepository,
  ) {}

  /** Validates, runs and stores one message. The JSON endpoint; streaming uses the two steps. */
  async send(ctx: RequestContext, input: SendMessageInput, options: SendOptions = {}): Promise<ChatReply> {
    return this.complete(await this.prepare(ctx, input), options);
  }

  /**
   * Everything that can fail before the agent runs: conversation ownership and the
   * company. Separate from complete() so the SSE endpoint can still answer these errors
   * with a normal JSON status before it commits to a 200 event stream. Also fixes the
   * conversation id, so a streaming client learns it before the answer exists.
   */
  async prepare(ctx: RequestContext, input: SendMessageInput): Promise<PreparedTurn> {
    // Loaded (and ownership checked) before spending any tokens.
    const existing = input.conversationId
      ? await this.conversations.findById(ctx.companyId, ctx.userId, input.conversationId)
      : null;
    if (input.conversationId && !existing) throw conversationNotFound();

    const company = await this.companies.findById(ctx.companyId);
    if (!company) throw new NotFoundError("COMPANY_NOT_FOUND", "Company not found");

    return {
      ctx,
      message: input.message,
      companyName: company.name,
      conversationId: existing?.id ?? this.conversations.newId(),
      existing,
    };
  }

  /**
   * Runs the agent and stores the exchange. Nothing is stored when the agent fails or
   * the client aborts, so a conversation never ends with an unanswered question the
   * next request would replay.
   */
  async complete(turn: PreparedTurn, options: SendOptions = {}): Promise<ChatReply> {
    const { ctx, existing, conversationId } = turn;
    const userMessageAt = new Date();
    const result = await this.agent.run({
      ctx: { companyId: ctx.companyId, userId: ctx.userId },
      companyName: turn.companyName,
      history: existing ? toHistory(existing.messages) : [],
      message: turn.message,
      signal: options.signal,
      onEvent: options.onEvent,
      stream: options.stream,
    });

    const exchange: StoredMessage[] = [
      { role: "user", content: turn.message, createdAt: userMessageAt },
      {
        role: "assistant",
        content: result.reply,
        toolCalls: result.toolCalls,
        products: result.products,
        createdAt: new Date(),
      },
    ];

    if (existing) {
      const appended = await this.conversations.appendMessages(ctx.companyId, ctx.userId, conversationId, exchange);
      if (!appended) throw conversationNotFound();
    } else {
      await this.conversations.create(ctx.companyId, ctx.userId, {
        id: conversationId,
        title: titleFrom(turn.message),
        messages: exchange,
      });
    }

    return { conversationId, reply: result.reply, products: result.products, toolCalls: result.toolCalls };
  }

  listConversations(ctx: RequestContext): Promise<ConversationSummary[]> {
    return this.conversations.listByUser(ctx.companyId, ctx.userId);
  }

  async getConversation(ctx: RequestContext, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(ctx.companyId, ctx.userId, conversationId);
    if (!conversation) throw conversationNotFound();
    return conversation;
  }
}
