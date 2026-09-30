import { z } from "zod";

// Mongo ObjectId, as the server validates `:id` (objectIdSchema).
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * `?c=<id>`: the open conversation, so refresh and back/forward keep it. A malformed id
 * falls back to a new conversation via `.catch` instead of an error page; a well-formed
 * id that is not the user's is a 404 from the server, shown as "not found" in the page.
 */
export const chatSearchSchema = z.object({
  c: z.string().regex(OBJECT_ID).optional().catch(undefined),
});

export type ChatSearch = z.infer<typeof chatSearchSchema>;
