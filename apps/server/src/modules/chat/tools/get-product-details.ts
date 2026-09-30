import { z } from "zod";

import { toProductDto } from "../../products/product.dto";
import { objectIdSchema } from "../../../shared/validation";
import { toProductView } from "./product-view";
import { type CatalogReader, defineTool, ToolError } from "./tool";

const inputSchema = z.object({
  productId: z.string().max(64).describe("The product id, exactly as returned by search_products."),
});

export function createGetProductDetailsTool(products: CatalogReader) {
  return defineTool({
    name: "get_product_details",
    description:
      "Get one product by id, with its full description. Use it when the customer asks for details, " +
      "specifications or a comparison of specific products already found with search_products. Do not " +
      "guess ids: only use ids returned by search_products in this conversation.",
    inputSchema,
    async execute({ productId }, ctx) {
      // A malformed id and an id of another company get the same answer as a missing
      // one: the model cannot tell whether an id exists elsewhere (same rule as the 404).
      if (!objectIdSchema.safeParse(productId).success) throw new ToolError("product_not_found");

      const product = await products.findById(ctx.companyId, productId);
      if (!product) throw new ToolError("product_not_found");

      return {
        content: { product: toProductView(product, { fullDescription: true }) },
        resultCount: 1,
        products: [toProductDto(product)],
      };
    },
  });
}
