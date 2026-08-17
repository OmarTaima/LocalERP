import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { WorkCenter } from "@erp/shared";

export type WorkCenterDoc = Omit<WorkCenter, "id" | "tenantId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const workCenterSchema = new Schema<WorkCenterDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true },
    costPerHour: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

workCenterSchema.index({ tenantId: 1, name: 1 });

export const WorkCenterModel: Model<WorkCenterDoc> =
  (mongoose.models.WorkCenter as Model<WorkCenterDoc>) || mongoose.model<WorkCenterDoc>("WorkCenter", workCenterSchema);