import { z } from "zod";

import { objectIdSchema } from "../../shared/validation";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PRODUCT_SORTS } from "./product.repository";

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

// Query strings arrive as strings; `?search=` (empty) means "no filter", not "match empty".
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const optionalCents = z.preprocess(blankToUndefined, z.coerce.number().int().min(0).optional());

// A repeated param (?search=a&search=b) arrives as an array and fails z.string(): 400.
export const listProductsQuerySchema = z
  .object({
    search: optionalText(100),
    category: optionalText(60),
    minPriceCents: optionalCents,
    maxPriceCents: optionalCents,
    sort: z.enum(PRODUCT_SORTS).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine(
    (q) => q.minPriceCents === undefined || q.maxPriceCents === undefined || q.minPriceCents <= q.maxPriceCents,
    { message: "minPriceCents must be less than or equal to maxPriceCents", path: ["minPriceCents"] },
  );

export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
