import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Employee } from "@erp/shared";

export type EmployeeDoc = Omit<Employee, "id" | "companyId" | "userId" | "departmentId" | "hireDate"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId | null;
  departmentId: Types.ObjectId;
  hireDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const employeeSchema = new Schema<EmployeeDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    position: { type: String, required: true },
    salary: { type: Number, required: true, min: 0 },
    hireDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "onLeave", "terminated"], default: "active" },
  },
  { timestamps: true },
);

employeeSchema.index({ companyId: 1, email: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, departmentId: 1 });
employeeSchema.index({ companyId: 1, status: 1 });
employeeSchema.index({ companyId: 1, name: "text", email: "text" });

export const EmployeeModel: Model<EmployeeDoc> =
  (mongoose.models.Employee as Model<EmployeeDoc>) || mongoose.model<EmployeeDoc>("Employee", employeeSchema);