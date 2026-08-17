import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Batch } from "@erp/shared";

export type BatchDoc = Omit<Batch, "id" | "companyId" | "productId" | "supplierId" | "expiryDate" | "receivedAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  supplierId: Types.ObjectId | null;
  expiryDate: Date | null;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const batchSchema = new Schema<BatchDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    lotNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, default: null },
    quantity: { type: Number, required: true, min: 0 },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

batchSchema.index({ companyId: 1, productId: 1, lotNumber: 1 }, { unique: true });
batchSchema.index({ companyId: 1, expiryDate: 1 });

export const BatchModel: Model<BatchDoc> =
  (mongoose.models.Batch as Model<BatchDoc>) || mongoose.model<BatchDoc>("Batch", batchSchema);