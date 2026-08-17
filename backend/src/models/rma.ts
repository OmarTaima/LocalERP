import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Rma } from "@erp/shared";

export type RmaDoc = Omit<Rma, "id" | "tenantId" | "orderId" | "restockedAt"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  orderId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  restockedAt: Date | null;
};

const { Schema } = mongoose;

const rmaSchema = new Schema<RmaDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    rmaNumber: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "SalesOrder", required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
          batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
          condition: { type: String, default: "" },
        },
      ],
      required: true,
    },
    reason: { type: String, required: true },
    status: { type: String, enum: ["requested", "approved", "received", "refunded", "rejected"], default: "requested" },
    restockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

rmaSchema.index({ tenantId: 1, rmaNumber: 1 }, { unique: true });
rmaSchema.index({ tenantId: 1, orderId: 1, createdAt: -1 });

export const RmaModel: Model<RmaDoc> =
  (mongoose.models.Rma as Model<RmaDoc>) || mongoose.model<RmaDoc>("Rma", rmaSchema);