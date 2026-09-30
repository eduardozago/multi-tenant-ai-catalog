import type { Product } from "./product.repository";

/** Shape of a product in API responses. No company_id (implied by the session), createdBy or __v. */
export type ProductDto = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    category: product.category,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
