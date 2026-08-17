import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Department } from "@erp/shared";

export type DepartmentDoc = Omit<Department, "id" | "companyId" | "parentId" | "headUserId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  headUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const departmentSchema = new Schema<DepartmentDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    headUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });
departmentSchema.index({ companyId: 1, parentId: 1 });

export const DepartmentModel: Model<DepartmentDoc> =
  (mongoose.models.Department as Model<DepartmentDoc>) || mongoose.model<DepartmentDoc>("Department", departmentSchema);