import { z } from "zod";

import { objectIdSchema } from "../../shared/validation";

const imageUrlSchema = z.url({ protocol: /^https?$/, error: "Must be an http or https URL" }).max(2048);

// No company_id or createdBy: both come from req.auth. Unknown keys (including a
// company_id sent by the client) are stripped by z.object.
export const createProductBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  // z.int() also rejects unsafe integers; cents avoid floating point money (D-13).
  priceCents: z.int().min(0),
  category: z.string().trim().min(2).max(60),
  imageUrl: imageUrlSchema.optional(),
});

// Partial update. `imageUrl: null` removes the image; omitting a field leaves it unchanged.
export const updateProductBodySchema = createProductBodySchema
  .extend({ imageUrl: imageUrlSchema.nullable() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "At least one field is required");

export const productParamsSchema = z.object({ id: objectIdSchema });

export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
