import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Attendance } from "@erp/shared";

export type AttendanceDoc = Omit<Attendance, "id" | "companyId" | "employeeId" | "date" | "shiftPatternId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: Date;
  shiftPatternId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const attendanceSchema = new Schema<AttendanceDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "leave", "holiday", "late"], required: true },
    shiftPatternId: { type: Schema.Types.ObjectId, ref: "ShiftPattern", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ companyId: 1, date: 1, status: 1 });

export const AttendanceModel: Model<AttendanceDoc> =
  (mongoose.models.Attendance as Model<AttendanceDoc>) || mongoose.model<AttendanceDoc>("Attendance", attendanceSchema);