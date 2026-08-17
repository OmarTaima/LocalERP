import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { StockMovement } from "@erp/shared";

export type StockMovementDoc = Omit<
  StockMovement,
  "id" | "companyId" | "productId" | "warehouseId" | "batchId" | "referenceId" | "userId"
> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  batchId: Types.ObjectId | null;
  referenceId: Types.ObjectId | null;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const stockMovementSchema = new Schema<StockMovementDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", default: null },
    quantity: { type: Number, required: true },
    type: {
      type: String,
      enum: ["sold", "received", "adjusted", "transferred", "returned", "consumed", "produced"],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

stockMovementSchema.index({ companyId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ companyId: 1, referenceId: 1 });
stockMovementSchema.index({ companyId: 1, createdAt: -1 });

export const StockMovementModel: Model<StockMovementDoc> =
  (mongoose.models.StockMovement as Model<StockMovementDoc>) ||
  mongoose.model<StockMovementDoc>("StockMovement", stockMovementSchema);