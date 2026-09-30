import { z } from "zod";

import { objectIdSchema } from "../../shared/validation";
import {
  DEFAULT_PAGE_SIZE,
  HTTP_URL,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  PRODUCT_SORTS,
} from "./product.constants";

// z.url() alone accepts URLs with spaces, which the model's HTTP_URL rejects.
const imageUrlSchema = z
  .url({ protocol: /^https?$/, error: "Must be an http or https URL" })
  .regex(HTTP_URL, "Must be an http or https URL")
  .max(2048);

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

const priceRangeIsOrdered = {
  check: (q: { minPriceCents?: number; maxPriceCents?: number }) =>
    q.minPriceCents === undefined || q.maxPriceCents === undefined || q.minPriceCents <= q.maxPriceCents,
  params: { message: "minPriceCents must be less than or equal to maxPriceCents", path: ["minPriceCents"] },
};

/**
 * Filters accepted by ProductRepository.search. Strict types, no coercion: the agent
 * tools pass model-provided values here, so NaN, objects (`{ $ne: "x" }`) or unknown
 * sorts are rejected instead of reaching the query. A limit above the maximum is
 * clamped rather than rejected, so a model asking for "100 products" still gets 50.
 */
export const productSearchFiltersSchema = z
  .object({
    search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
    category: z.string().trim().max(60).optional(),
    minPriceCents: z.int().min(0).optional(),
    maxPriceCents: z.int().min(0).optional(),
    sort: z.enum(PRODUCT_SORTS).default("newest"),
    page: z.int().min(1).default(1),
    limit: z
      .int()
      .min(1)
      .default(DEFAULT_PAGE_SIZE)
      .transform((limit) => Math.min(limit, MAX_PAGE_SIZE)),
  })
  .refine(priceRangeIsOrdered.check, priceRangeIsOrdered.params);

// Query strings arrive as strings; `?search=` (empty) means "no filter", not "match empty".
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const optionalCents = z.preprocess(blankToUndefined, z.coerce.number().int().min(0).optional());

// HTTP version of the filters: coerces query strings and rejects (not clamps) limit > 50,
// so API clients learn the maximum. A repeated param (?search=a&search=b) arrives as an
// array and fails z.string(): 400.
export const listProductsQuerySchema = z
  .object({
    search: optionalText(MAX_SEARCH_LENGTH),
    category: optionalText(60),
    minPriceCents: optionalCents,
    maxPriceCents: optionalCents,
    sort: z.enum(PRODUCT_SORTS).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine(priceRangeIsOrdered.check, priceRangeIsOrdered.params);

export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
/** What callers may pass (all optional); the repository applies defaults. */
export type ProductSearchFilters = z.input<typeof productSearchFiltersSchema>;
