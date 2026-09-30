import { z } from "zod";

import { type CatalogReader, defineTool } from "./tool";

export function createListCategoriesTool(products: CatalogReader) {
  return defineTool({
    name: "list_categories",
    description:
      "List every product category of the store. Use it when the customer asks what the store sells or " +
      "which categories exist, or to find the exact category name before filtering search_products by " +
      "category. Returns names only, no products.",
    inputSchema: z.object({}),
    async execute(_input, ctx) {
      const categories = await products.listCategories(ctx.companyId);
      return { content: { categories }, resultCount: categories.length };
    },
  });
}
