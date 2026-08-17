import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { MrpSuggestion } from "@erp/shared";

export type MrpSuggestionDoc = Omit<MrpSuggestion, "id" | "tenantId" | "productId" | "warehouseId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const mrpSuggestionSchema = new Schema<MrpSuggestionDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    type: { type: String, enum: ["purchase", "produce"], required: true },
    suggestedQuantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    status: { type: String, enum: ["open", "actioned", "dismissed"], default: "open" },
  },
  { timestamps: true },
);

mrpSuggestionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
mrpSuggestionSchema.index({ tenantId: 1, productId: 1, warehouseId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "open" } });

export const MrpSuggestionModel: Model<MrpSuggestionDoc> =
  (mongoose.models.MrpSuggestion as Model<MrpSuggestionDoc>) ||
  mongoose.model<MrpSuggestionDoc>("MrpSuggestion", mrpSuggestionSchema);