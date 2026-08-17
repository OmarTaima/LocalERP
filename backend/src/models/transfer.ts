import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Transfer } from "@erp/shared";

export type TransferDoc = Omit<Transfer, "id" | "tenantId" | "fromWarehouseId" | "toWarehouseId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  fromWarehouseId: Types.ObjectId;
  toWarehouseId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const transferSchema = new Schema<TransferDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    fromWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
          batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
        },
      ],
      required: true,
    },
    status: { type: String, enum: ["draft", "in-transit", "received", "cancelled"], default: "in-transit" },
    referenceNumber: { type: String, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

transferSchema.index({ tenantId: 1, referenceNumber: 1 }, { unique: true });
transferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const TransferModel: Model<TransferDoc> =
  (mongoose.models.Transfer as Model<TransferDoc>) || mongoose.model<TransferDoc>("Transfer", transferSchema);