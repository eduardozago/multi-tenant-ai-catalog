import type { RequestContext } from "../../shared/context";
import { NotFoundError } from "../../shared/errors";
import type { Product, ProductRepository, ProductSearchResult } from "./product.repository";
import type { CreateProductInput, ProductSearchFilters, UpdateProductInput } from "./product.schemas";

export type ProductPage = ProductSearchResult & { totalPages: number };

// Same error for "does not exist" and "belongs to another company": a 403 would
// confirm that the id exists in some other tenant.
const productNotFound = () => new NotFoundError("PRODUCT_NOT_FOUND", "Product not found");

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async list(ctx: RequestContext, filters: ProductSearchFilters): Promise<ProductPage> {
    const { items, total, page, limit } = await this.products.search(ctx.companyId, filters);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  listCategories(ctx: RequestContext): Promise<string[]> {
    return this.products.listCategories(ctx.companyId);
  }

  async getById(ctx: RequestContext, productId: string): Promise<Product> {
    const product = await this.products.findById(ctx.companyId, productId);
    if (!product) throw productNotFound();
    return product;
  }

  /** Always creates in the caller's company, owned by the caller. */
  create(ctx: RequestContext, input: CreateProductInput): Promise<Product> {
    return this.products.create(ctx.companyId, {
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      category: input.category,
      imageUrl: input.imageUrl,
      createdBy: ctx.userId,
    });
  }

  async update(ctx: RequestContext, productId: string, input: UpdateProductInput): Promise<Product> {
    // Mapped field by field, like create: the input never reaches the update as a whole.
    const product = await this.products.update(ctx.companyId, productId, {
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      category: input.category,
      imageUrl: input.imageUrl,
    });
    if (!product) throw productNotFound();
    return product;
  }

  async delete(ctx: RequestContext, productId: string): Promise<void> {
    const deleted = await this.products.delete(ctx.companyId, productId);
    if (!deleted) throw productNotFound();
  }
}
