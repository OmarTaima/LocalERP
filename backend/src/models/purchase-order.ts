import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { PurchaseOrder } from "@erp/shared";

type GrnItemDoc = { productId: Types.ObjectId; quantity: number; unitCost: number };
type GrnDoc = { grnNumber: string; receivedAt: Date; items: GrnItemDoc[] };

export type PurchaseOrderDoc = Omit<PurchaseOrder, "id" | "tenantId" | "supplierId" | "approvalId" | "expectedDate" | "grns"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  supplierId: Types.ObjectId;
  approvalId: Types.ObjectId | null;
  expectedDate: Date;
  grns: GrnDoc[];
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const purchaseOrderSchema = new Schema<PurchaseOrderDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    poNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitCost: { type: Number, required: true, min: 0 },
          batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
        },
      ],
      required: true,
    },
    expectedDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "pending-approval", "sent", "partial", "received", "closed", "rejected"],
      default: "draft",
    },
    approvalId: { type: Schema.Types.ObjectId, ref: "ApprovalRequest", default: null },
    grns: {
      type: [
        {
          grnNumber: { type: String, required: true },
          receivedAt: { type: Date, required: true },
          items: [
            {
              productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
              quantity: { type: Number, required: true, min: 1 },
              unitCost: { type: Number, required: true, min: 0 },
            },
          ],
        },
      ],
      default: [],
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, status: 1 });

export const PurchaseOrderModel: Model<PurchaseOrderDoc> =
  (mongoose.models.PurchaseOrder as Model<PurchaseOrderDoc>) ||
  mongoose.model<PurchaseOrderDoc>("PurchaseOrder", purchaseOrderSchema);