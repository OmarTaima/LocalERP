import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Company } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type CompanyDoc = Omit<Company, "id"> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const companySchema = new Schema<CompanyDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    plan: { type: String, enum: ["starter", "pro", "enterprise"], default: "starter" },
    isActive: { type: Boolean, default: true },
    settings: {
      currency: { type: String, default: "USD" },
      taxRate: { type: Number, default: 0 },
      timezone: { type: String, default: "UTC" },
    },
    limits: {
      maxUsers: { type: Number, default: 10 },
      maxProducts: { type: Number, default: 500 },
      features: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export const CompanyModel: Model<CompanyDoc> =
  (models.Company as Model<CompanyDoc>) || model<CompanyDoc>("Company", companySchema);