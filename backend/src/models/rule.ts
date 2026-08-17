import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ReorderRule, TaxRule } from "@erp/shared";

const { Schema } = mongoose;

export type TaxRuleDoc = Omit<TaxRule, "id" | "tenantId" | "categoryId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const taxRuleSchema = new Schema<TaxRuleDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    appliesTo: { type: String, enum: ["product", "category", "region"], required: true },
    region: { type: String, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

taxRuleSchema.index({ tenantId: 1, appliesTo: 1, region: 1 });

export const TaxRuleModel: Model<TaxRuleDoc> =
  (mongoose.models.TaxRule as Model<TaxRuleDoc>) || mongoose.model<TaxRuleDoc>("TaxRule", taxRuleSchema);

export type ReorderRuleDoc = Omit<ReorderRule, "id" | "tenantId" | "productId" | "warehouseId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const reorderRuleSchema = new Schema<ReorderRuleDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    minQuantity: { type: Number, required: true, min: 0 },
    maxQuantity: { type: Number, required: true, min: 1 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

reorderRuleSchema.index({ tenantId: 1, productId: 1, warehouseId: 1 }, { unique: true });

export const ReorderRuleModel: Model<ReorderRuleDoc> =
  (mongoose.models.ReorderRule as Model<ReorderRuleDoc>) ||
  mongoose.model<ReorderRuleDoc>("ReorderRule", reorderRuleSchema);