import { model, Schema, type Types } from "mongoose";

import { ROLES, type Role } from "../../shared/context";
import { tenantScoped } from "../../shared/db/tenant-scoped.plugin";

export type UserDocument = {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    // Globally unique: login is by email alone, before the tenant is known.
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    // Never loaded unless a query explicitly asks for `+passwordHash`.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true },
);

userSchema.plugin(tenantScoped);

export const UserModel = model<UserDocument>("User", userSchema);
