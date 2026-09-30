import type { QueryFilter, SortOrder } from "mongoose";

import { escapeRegex } from "../../shared/regex";
import { NAME_COLLATION, type ProductDocument, ProductModel } from "./product.model";

export type Product = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProduct = {
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
  createdBy: string;
};

/** Fields an update may change. `imageUrl: null` removes the image. */
export type ProductChanges = Partial<{
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string | null;
}>;

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "name_asc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

/**
 * Shared by the REST listing and the chat agent tools. Every field is optional;
 * the tenant is never part of the filters, it is the separate first argument.
 */
export type ProductSearchFilters = {
  search?: string;
  category?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
};

/** `page` and `limit` are the values actually applied, after defaults and clamping. */
export type ProductSearchResult = { items: Product[]; total: number; page: number; limit: number };

// _id breaks ties so pages never repeat or skip products with equal sort keys.
const SORTS: Record<ProductSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { priceCents: 1, _id: 1 },
  price_desc: { priceCents: -1, _id: -1 },
  name_asc: { name: 1, _id: 1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

// The only fields copied into $set. Listing them keeps company_id and createdBy out
// of updates even if a caller passes a wider object.
const EDITABLE_FIELDS = ["name", "description", "priceCents", "category"] as const;

function toProduct(doc: ProductDocument): Product {
  return {
    id: doc._id.toString(),
    companyId: doc.company_id.toString(),
    name: doc.name,
    description: doc.description,
    priceCents: doc.priceCents,
    category: doc.category,
    imageUrl: doc.imageUrl ?? null,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class ProductRepository {
  async findById(companyId: string, productId: string): Promise<Product | null> {
    const doc = await ProductModel.findOne({ _id: productId, company_id: companyId }).lean();
    return doc ? toProduct(doc) : null;
  }

  /**
   * Filtered, sorted, paginated listing. Page size is clamped here as well as in the
   * HTTP schema, because the agent tools call this method with model-provided input.
   */
  async search(companyId: string, filters: ProductSearchFilters = {}): Promise<ProductSearchResult> {
    const page = clamp(filters.page ?? 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = clamp(filters.limit ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const sort = filters.sort ?? "newest";

    const query: QueryFilter<ProductDocument> = { company_id: companyId };
    if (filters.category !== undefined) query.category = filters.category;
    if (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined) {
      query.priceCents = {
        ...(filters.minPriceCents !== undefined && { $gte: filters.minPriceCents }),
        ...(filters.maxPriceCents !== undefined && { $lte: filters.maxPriceCents }),
      };
    }
    if (filters.search) {
      // Escaped: the input is matched literally, never interpreted as a pattern (D-16).
      const pattern = new RegExp(escapeRegex(filters.search), "i");
      query.$or = [{ name: pattern }, { description: pattern }];
    }

    const find = ProductModel.find(query)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit);
    if (sort === "name_asc") find.collation(NAME_COLLATION);

    const [total, docs] = await Promise.all([ProductModel.countDocuments(query), find.lean()]);
    return { items: docs.map(toProduct), total, page, limit };
  }

  async create(companyId: string, input: NewProduct): Promise<Product> {
    // company_id is set explicitly from the argument, never spread from input.
    const doc = await ProductModel.create({
      company_id: companyId,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      category: input.category,
      imageUrl: input.imageUrl,
      createdBy: input.createdBy,
    });
    return toProduct(doc.toObject());
  }

  /** Returns null when the product does not exist in this company. */
  async update(companyId: string, productId: string, changes: ProductChanges): Promise<Product | null> {
    const $set: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (changes[field] !== undefined) $set[field] = changes[field];
    }
    const $unset: Record<string, 1> = {};
    if (changes.imageUrl === null) $unset.imageUrl = 1;
    else if (changes.imageUrl !== undefined) $set.imageUrl = changes.imageUrl;

    const doc = await ProductModel.findOneAndUpdate(
      { _id: productId, company_id: companyId },
      { $set, $unset },
      // Schema validators do not run on updates by default.
      { runValidators: true, returnDocument: "after" },
    ).lean();
    return doc ? toProduct(doc) : null;
  }

  /** Hard delete (D-15). Returns false when the product does not exist in this company. */
  async delete(companyId: string, productId: string): Promise<boolean> {
    const result = await ProductModel.deleteOne({ _id: productId, company_id: companyId });
    return result.deletedCount === 1;
  }
}
