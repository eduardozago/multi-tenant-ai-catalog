import { model, Schema, type Types } from "mongoose";

export type CompanyDocument = {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

// Not tenant-scoped: a company is the tenant itself.
const companySchema = new Schema<CompanyDocument>(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const CompanyModel = model<CompanyDocument>("Company", companySchema);
