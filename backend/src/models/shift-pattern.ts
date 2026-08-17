import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ShiftPattern } from "@erp/shared";

export type ShiftPatternDoc = Omit<ShiftPattern, "id" | "tenantId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const shiftPatternSchema = new Schema<ShiftPatternDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    days: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  },
  { timestamps: true },
);

shiftPatternSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const ShiftPatternModel: Model<ShiftPatternDoc> =
  (mongoose.models.ShiftPattern as Model<ShiftPatternDoc>) || mongoose.model<ShiftPatternDoc>("ShiftPattern", shiftPatternSchema);