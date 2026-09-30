import { z } from "zod";

import { parseBRLToCents } from "@/lib/format";

// Mirrors apps/server/src/modules/products/product.constants.ts.
export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "name_asc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const DEFAULT_SORT: ProductSort = "newest";

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Mais recentes",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  name_asc: "Nome (A–Z)",
};

export const DESCRIPTION_MAX_LENGTH = 2000;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * Catalog filters in the URL (`/products?search=…&page=2`). A hand-edited or stale value
 * falls back to its default via `.catch`, never an error page. Defaults are `undefined`
 * so they stay out of the URL: `/products` and `/products?sort=newest&page=1` are one view.
 */
export const productSearchSchema = z.object({
  search: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()).catch(undefined),
  category: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()).catch(undefined),
  sort: z.enum(PRODUCT_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
});

export type ProductSearch = z.infer<typeof productSearchSchema>;

// Same rule as the server's HTTP_URL + z.url({ protocol: /^https?$/ }).
const HTTP_URL = /^https?:\/\/\S+$/i;
const isHttpUrl = (value: string) => HTTP_URL.test(value) && URL.canParse(value);

/**
 * Mirrors createProductBodySchema. `priceCents` is typed as masked text ("1.234,56") and
 * leaves the schema as integer cents; `imageUrl` is "" when empty and the caller decides
 * whether that means "omit" (create) or `null` (edit, removes the image).
 */
export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres")
    .max(120, "O nome deve ter no máximo 120 caracteres"),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, `A descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`),
  priceCents: z
    .string()
    .trim()
    .min(1, "Informe o preço")
    .transform((value, ctx) => {
      const cents = parseBRLToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Preço inválido" });
        return z.NEVER;
      }
      return cents;
    }),
  category: z
    .string()
    .trim()
    .min(2, "A categoria deve ter pelo menos 2 caracteres")
    .max(60, "A categoria deve ter no máximo 60 caracteres"),
  imageUrl: z
    .string()
    .trim()
    .max(2048, "A URL deve ter no máximo 2048 caracteres")
    .refine((value) => value === "" || isHttpUrl(value), "Informe uma URL http ou https válida"),
});

/** What the fields hold while editing (price as text). */
export type ProductFormValues = z.input<typeof productFormSchema>;
/** What a valid submit produces (price in cents). */
export type ProductFormOutput = z.output<typeof productFormSchema>;
