import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Department } from "@erp/shared";

export type DepartmentDoc = Omit<Department, "id" | "tenantId" | "parentId" | "headUserId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  headUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const departmentSchema = new Schema<DepartmentDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    headUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

departmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });
departmentSchema.index({ tenantId: 1, parentId: 1 });

export const DepartmentModel: Model<DepartmentDoc> =
  (mongoose.models.Department as Model<DepartmentDoc>) || mongoose.model<DepartmentDoc>("Department", departmentSchema);