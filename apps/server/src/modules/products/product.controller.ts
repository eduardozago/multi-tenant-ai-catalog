import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import { toProductDto } from "./product.dto";
import type {
  CreateProductInput,
  ListProductsQuery,
  ProductParams,
  UpdateProductInput,
} from "./product.schemas";
import type { ProductService } from "./product.service";

export class ProductController {
  constructor(private readonly products: ProductService) {}

  list = async (req: Request, res: Response) => {
    const page = await this.products.list(getContext(req), req.validated.query as ListProductsQuery);
    // Paginated envelope (D-18); meta is listed field by field so nothing internal leaks.
    res.status(200).json({
      data: page.items.map(toProductDto),
      meta: { page: page.page, limit: page.limit, total: page.total, totalPages: page.totalPages },
    });
  };

  categories = async (req: Request, res: Response) => {
    const categories = await this.products.listCategories(getContext(req));
    res.status(200).json({ categories });
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
