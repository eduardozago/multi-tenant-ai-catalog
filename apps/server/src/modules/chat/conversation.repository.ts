import { Types } from "mongoose";

import type { ConversationDocument, StoredMessage } from "./conversation.model";
import { ConversationModel } from "./conversation.model";

export type Conversation = {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationSummary = { id: string; title: string; updatedAt: Date };

/** Sidebar length; older conversations stay stored but are not listed. */
const MAX_LISTED = 50;

function toConversation(doc: ConversationDocument): Conversation {
  return {
    id: doc._id.toString(),
    title: doc.title,
    messages: doc.messages,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Every method takes the tenant and the owner: a conversation is found only by
 * `{ _id, company_id, userId }`, so another user of the same company gets the same
 * "not found" as another company.
 */
export class ConversationRepository {
  /**
   * Id for a conversation that is created only after the first answer, so a streaming
   * client can learn it before the agent finishes.
   */
  newId(): string {
    return new Types.ObjectId().toString();
  }

  async findById(companyId: string, userId: string, conversationId: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findOne({ _id: conversationId, company_id: companyId, userId }).lean();
    return doc ? toConversation(doc) : null;
  }

  async listByUser(companyId: string, userId: string): Promise<ConversationSummary[]> {
    const docs = await ConversationModel.find({ company_id: companyId, userId })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(MAX_LISTED)
      .select({ title: 1, updatedAt: 1 })
      .lean();
    return docs.map((doc) => ({ id: doc._id.toString(), title: doc.title, updatedAt: doc.updatedAt }));
  }

  async create(
    companyId: string,
    userId: string,
    input: { id: string; title: string; messages: StoredMessage[] },
  ): Promise<void> {
    await ConversationModel.create({
      _id: input.id,
      company_id: companyId,
      userId,
      title: input.title,
      messages: input.messages,
    });
  }

  /** Appends with $push (never rewrites earlier messages). False when not found for this owner. */
  async appendMessages(
    companyId: string,
    userId: string,
    conversationId: string,
    messages: StoredMessage[],
  ): Promise<boolean> {
    const result = await ConversationModel.updateOne(
      { _id: conversationId, company_id: companyId, userId },
      { $push: { messages: { $each: messages } } },
    );
    return result.matchedCount === 1;
  }
}
