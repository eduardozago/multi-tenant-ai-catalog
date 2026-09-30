import type { QueryFilter, SortOrder, UpdateQuery } from "mongoose";

import { escapeRegex } from "../../shared/regex";
import { PT_LOCALE, type ProductSort } from "./product.constants";
import { NAME_COLLATION, type ProductDocument, ProductModel } from "./product.model";
import { type ProductSearchFilters, productSearchFiltersSchema } from "./product.schemas";

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

/** `page` and `limit` are the values actually applied, after defaults and clamping. */
export type ProductSearchResult = { items: Product[]; total: number; page: number; limit: number };

// _id breaks ties so pages never repeat or skip products with equal sort keys.
const SORTS: Record<ProductSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { priceCents: 1, _id: 1 },
  price_desc: { priceCents: -1, _id: -1 },
  name_asc: { name: 1, _id: 1 },
};

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
   * Filtered, sorted, paginated listing, shared by the REST listing and the chat agent
   * tools. The tenant is the separate first argument, never a filter. Filters are
   * re-validated here because the tools pass model-provided values without the HTTP
   * schema; invalid input throws a ZodError (400 over HTTP, a tool error for the agent).
   */
  async search(companyId: string, input: ProductSearchFilters = {}): Promise<ProductSearchResult> {
    const { search, category, minPriceCents, maxPriceCents, sort, page, limit } =
      productSearchFiltersSchema.parse(input);

    const query: QueryFilter<ProductDocument> = { company_id: companyId };
    if (category !== undefined) query.category = category;
    if (minPriceCents !== undefined || maxPriceCents !== undefined) {
      query.priceCents = {
        ...(minPriceCents !== undefined && { $gte: minPriceCents }),
        ...(maxPriceCents !== undefined && { $lte: maxPriceCents }),
      };
    }
    if (search) {
      // Escaped: the input is matched literally, never interpreted as a pattern (D-16).
      const pattern = new RegExp(escapeRegex(search), "i");
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

  /** Distinct categories of one company, sorted for display in Portuguese order. */
  async listCategories(companyId: string): Promise<string[]> {
    const categories: string[] = await ProductModel.distinct("category", { company_id: companyId });
    return categories.sort((a, b) => a.localeCompare(b, PT_LOCALE));
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
    if (typeof changes.imageUrl === "string") $set.imageUrl = changes.imageUrl;

    const update: UpdateQuery<ProductDocument> = { $set };
    if (changes.imageUrl === null) update.$unset = { imageUrl: 1 };

    const doc = await ProductModel.findOneAndUpdate(
      { _id: productId, company_id: companyId },
      update,
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
