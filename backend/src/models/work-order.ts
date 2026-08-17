import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { WorkOrder } from "@erp/shared";

export type WorkOrderDoc = Omit<WorkOrder, "id" | "companyId" | "bomId" | "productId" | "workCenterId" | "startedAt" | "completedAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  bomId: Types.ObjectId;
  productId: Types.ObjectId;
  workCenterId: Types.ObjectId;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const workOrderSchema = new Schema<WorkOrderDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    woNumber: { type: String, required: true },
    bomId: { type: Schema.Types.ObjectId, ref: "Bom", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    workCenterId: { type: Schema.Types.ObjectId, ref: "WorkCenter", required: true },
    plannedHours: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["draft", "released", "in-progress", "completed", "cancelled"], default: "draft" },
    materialConsumed: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
          batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
        },
      ],
      default: [],
    },
    finishedGoods: {
      type: [
        {
          batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
    },
    unitCost: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workOrderSchema.index({ companyId: 1, woNumber: 1 }, { unique: true });
workOrderSchema.index({ companyId: 1, status: 1 });

export const WorkOrderModel: Model<WorkOrderDoc> =
  (mongoose.models.WorkOrder as Model<WorkOrderDoc>) || mongoose.model<WorkOrderDoc>("WorkOrder", workOrderSchema);