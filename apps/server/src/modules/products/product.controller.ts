import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import type { Product } from "./product.repository";
import type {
  CreateProductInput,
  ListProductsQuery,
  ProductParams,
  UpdateProductInput,
} from "./product.schemas";
import type { ProductService } from "./product.service";

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

// No company_id (implied by the session), createdBy or __v.
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

export class ProductController {
  constructor(private readonly products: ProductService) {}

  list = async (req: Request, res: Response) => {
    const result = await this.products.list(getContext(req), req.validated.query as ListProductsQuery);
    const { items, ...meta } = result;
    res.status(200).json({ data: items.map(toProductDto), meta });
  };

  get = async (req: Request, res: Response) => {
    const { id } = req.validated.params as ProductParams;
    const product = await this.products.getById(getContext(req), id);
    res.status(200).json({ product: toProductDto(product) });
  };

  create = async (req: Request, res: Response) => {
    const product = await this.products.create(getContext(req), req.validated.body as CreateProductInput);
    res.status(201).json({ product: toProductDto(product) });
  };

  update = async (req: Request, res: Response) => {
    const { id } = req.validated.params as ProductParams;
    const product = await this.products.update(getContext(req), id, req.validated.body as UpdateProductInput);
    res.status(200).json({ product: toProductDto(product) });
  };

  delete = async (req: Request, res: Response) => {
    const { id } = req.validated.params as ProductParams;
    await this.products.delete(getContext(req), id);
    res.status(204).end();
  };
}
