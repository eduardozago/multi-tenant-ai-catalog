import { model, Schema, type Types } from "mongoose";

import { tenantScoped } from "../../shared/db/tenant-scoped.plugin";

export type ProductDocument = {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const HTTP_URL = /^https?:\/\/\S+$/i;

// zod validates at the edge; these validators are the last line of defense and
// also run on PATCH through `runValidators`.
const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    // Integer cents: floating point cannot represent most decimal prices exactly (see D-13).
    priceCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "priceCents must be an integer" },
    },
    // Free string; the tenant's category list is derived with distinct (see D-14).
    category: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    imageUrl: { type: String, trim: true, match: HTTP_URL },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  },
  { timestamps: true },
);

productSchema.plugin(tenantScoped);

// Every index starts with company_id: all queries are per tenant.
productSchema.index({ company_id: 1, createdAt: -1 }); // default listing (newest)
productSchema.index({ company_id: 1, category: 1 }); // category filter and distinct
productSchema.index({ company_id: 1, name: 1 }); // name_asc sort

export const ProductModel = model<ProductDocument>("Product", productSchema);
