import { z } from "zod";

import { toProductDto } from "../../products/product.dto";
import { MAX_SEARCH_LENGTH, PRODUCT_SORTS } from "../../products/product.constants";
import { toProductView } from "./product-view";
import { type CatalogReader, defineTool } from "./tool";

export const SEARCH_DEFAULT_LIMIT = 8;
export const SEARCH_MAX_LIMIT = 20;

// Upper bound so an absurd value cannot overflow into an unsafe integer of cents.
const MAX_PRICE_REAIS = 10_000_000;

/** Reais (as the customer says them) → integer cents (as stored, D-13). Rounds 12.345 → 1235. */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

const price = z.number().min(0).max(MAX_PRICE_REAIS).nullable();

// No tenant field: the company comes from ToolContext. Unknown keys (company_id,
// companyId) are stripped by z.object before execute sees the input.
const inputSchema = z
  .object({
    query: z
      .string()
      .max(MAX_SEARCH_LENGTH)
      .nullable()
      .describe("Words to match in the product name or description, e.g. 'ração gato'. Null to not filter."),
    category: z
      .string()
      .max(60)
      .nullable()
      .describe("Exact category name as returned by list_categories. Null for all categories."),
    minPrice: price.describe("Minimum price in reais (BRL), e.g. 49.9. Null for no minimum."),
    maxPrice: price.describe("Maximum price in reais (BRL), e.g. 100. Null for no maximum."),
    sort: z
      .enum(PRODUCT_SORTS)
      .nullable()
      .describe("Result order. price_asc for cheapest first, price_desc for most expensive. Null for newest."),
    limit: z
      .int()
      .min(1)
      .nullable()
      .describe(`How many products to return, up to ${SEARCH_MAX_LIMIT}. Null for ${SEARCH_DEFAULT_LIMIT}.`),
  })
  .refine((input) => input.minPrice === null || input.maxPrice === null || input.minPrice <= input.maxPrice, {
    message: "minPrice must be less than or equal to maxPrice",
    path: ["minPrice"],
  });

export function createSearchProductsTool(products: CatalogReader) {
  return defineTool({
    name: "search_products",
    description:
      "Search the store's product catalog. Returns matching products (id, name, category, price, short " +
      "description) and the total number of matches. Use it for any question about which products exist, " +
      "their prices, price ranges, cheapest or most expensive items, or products in a category. Combine " +
      "filters as needed. If a text search finds nothing, try fewer or more general words before saying " +
      "the product is not available. For the full description of one product use get_product_details.",
    inputSchema,
    async execute(input, ctx) {
      // null means "not provided": mapped to undefined so the repository applies no filter.
      const result = await products.search(ctx.companyId, {
        search: input.query ?? undefined,
        category: input.category ?? undefined,
        minPriceCents: input.minPrice === null ? undefined : reaisToCents(input.minPrice),
        maxPriceCents: input.maxPrice === null ? undefined : reaisToCents(input.maxPrice),
        sort: input.sort ?? undefined,
        limit: Math.min(input.limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT),
      });

      return {
        // total lets the model say "showing 8 of 23" instead of implying the list is complete.
        content: { total: result.total, count: result.items.length, products: result.items.map((p) => toProductView(p)) },
        resultCount: result.items.length,
        products: result.items.map(toProductDto),
      };
    },
  });
}
