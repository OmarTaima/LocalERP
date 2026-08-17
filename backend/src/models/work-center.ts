import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { WorkCenter } from "@erp/shared";

export type WorkCenterDoc = Omit<WorkCenter, "id" | "companyId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const workCenterSchema = new Schema<WorkCenterDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    costPerHour: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

workCenterSchema.index({ companyId: 1, name: 1 });

export const WorkCenterModel: Model<WorkCenterDoc> =
  (mongoose.models.WorkCenter as Model<WorkCenterDoc>) || mongoose.model<WorkCenterDoc>("WorkCenter", workCenterSchema);