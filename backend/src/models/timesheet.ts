import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Timesheet } from "@erp/shared";

export type TimesheetDoc = Omit<Timesheet, "id" | "tenantId" | "employeeId" | "date"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const timesheetSchema = new Schema<TimesheetDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0, max: 24 },
    project: { type: String, required: true },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["draft", "submitted", "approved"], default: "draft" },
  },
  { timestamps: true },
);

timesheetSchema.index({ tenantId: 1, employeeId: 1, date: 1 });
timesheetSchema.index({ tenantId: 1, status: 1 });

export const TimesheetModel: Model<TimesheetDoc> =
  (mongoose.models.Timesheet as Model<TimesheetDoc>) || mongoose.model<TimesheetDoc>("Timesheet", timesheetSchema);