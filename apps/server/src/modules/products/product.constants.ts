// Plain values shared by the model, the zod schemas and the repository, so neither
// the HTTP edge nor the agent tools depend on the data-access layer to know them.

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "name_asc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
export const MAX_SEARCH_LENGTH = 100;

// One rule for the zod schema and the Mongoose validator: if they disagree, a request
// that passes zod fails in Mongoose and becomes a 500.
export const HTTP_URL = /^https?:\/\/\S+$/i;

/** Portuguese ordering for names and categories ("Água" before "Bola"). */
export const PT_LOCALE = "pt";
