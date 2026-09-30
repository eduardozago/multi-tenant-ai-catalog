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

  /**
   * Runs the agent on a new or existing conversation of the caller and stores the
   * exchange. Nothing is stored when the agent fails, so a conversation never ends with
   * an unanswered question the next request would replay.
   */
  async send(ctx: RequestContext, input: SendMessageInput, options: SendOptions = {}): Promise<ChatReply> {
    // Loaded (and ownership checked) before spending any tokens.
    const existing = input.conversationId
      ? await this.conversations.findById(ctx.companyId, ctx.userId, input.conversationId)
      : null;
    if (input.conversationId && !existing) throw conversationNotFound();

    const company = await this.companies.findById(ctx.companyId);
    if (!company) throw new NotFoundError("COMPANY_NOT_FOUND", "Company not found");

    const userMessageAt = new Date();
    const result = await this.agent.run({
      ctx: { companyId: ctx.companyId, userId: ctx.userId },
      companyName: company.name,
      history: existing ? toHistory(existing.messages) : [],
      message: input.message,
      signal: options.signal,
      onEvent: options.onEvent,
    });

    const exchange: StoredMessage[] = [
      { role: "user", content: input.message, createdAt: userMessageAt },
      {
        role: "assistant",
        content: result.reply,
        toolCalls: result.toolCalls,
        products: result.products,
        createdAt: new Date(),
      },
    ];

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
      const appended = await this.conversations.appendMessages(ctx.companyId, ctx.userId, existing.id, exchange);
      if (!appended) throw conversationNotFound();
    } else {
      conversationId = this.conversations.newId();
      await this.conversations.create(ctx.companyId, ctx.userId, {
        id: conversationId,
        title: titleFrom(input.message),
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
