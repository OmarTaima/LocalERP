import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { LeaveRequest } from "@erp/shared";

export type LeaveRequestDoc = Omit<LeaveRequest, "id" | "companyId" | "employeeId" | "from" | "to" | "approvedBy" | "approvalId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  from: Date;
  to: Date;
  approvedBy: Types.ObjectId | null;
  approvalId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const leaveRequestSchema = new Schema<LeaveRequestDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    type: { type: String, enum: ["annual", "sick", "unpaid", "maternity", "paternity"], required: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvalId: { type: Schema.Types.ObjectId, ref: "ApprovalRequest", default: null },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ companyId: 1, employeeId: 1, status: 1 });
leaveRequestSchema.index({ companyId: 1, status: 1 });

export const LeaveRequestModel: Model<LeaveRequestDoc> =
  (mongoose.models.LeaveRequest as Model<LeaveRequestDoc>) || mongoose.model<LeaveRequestDoc>("LeaveRequest", leaveRequestSchema);