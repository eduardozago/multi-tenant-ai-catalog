import { model, Schema, type Types } from "mongoose";

import { tenantScoped } from "../../shared/db/tenant-scoped.plugin";
import type { ProductDto } from "../products/product.dto";
import type { ToolCallSummary } from "./chat.types";

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  /** Assistant only: what the agent queried, for transparency in the UI. */
  toolCalls?: ToolCallSummary[];
  /** Assistant only: snapshot of the product cards shown with the answer. */
  products?: ProductDto[];
  createdAt: Date;
};

export type ConversationDocument = {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
};

const messageSchema = new Schema<StoredMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    toolCalls: { type: [Schema.Types.Mixed], default: undefined },
    products: { type: [Schema.Types.Mixed], default: undefined },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationDocument>(
  {
    // Conversations are private to their owner inside the tenant: every query filters
    // by company_id (plugin) and userId (repository).
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

conversationSchema.plugin(tenantScoped);

// The sidebar query: one user's conversations, most recently active first.
conversationSchema.index({ company_id: 1, userId: 1, updatedAt: -1 });

export const ConversationModel = model<ConversationDocument>("Conversation", conversationSchema);
