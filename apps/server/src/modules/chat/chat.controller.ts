import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import type { ConversationParams, SendMessageInput } from "./chat.schemas";
import type { ChatService } from "./chat.service";

export class ChatController {
  constructor(private readonly chat: ChatService) {}

  send = async (req: Request, res: Response) => {
    const result = await this.chat.send(getContext(req), req.validated.body as SendMessageInput);
    res.status(200).json(result);
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
