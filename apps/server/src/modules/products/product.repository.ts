import { type ProductDocument, ProductModel } from "./product.model";

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
