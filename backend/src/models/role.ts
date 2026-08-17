import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Role } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type RoleDoc = Omit<Role, "id" | "companyId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const roleSchema = new Schema<RoleDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    permissions: { type: [String], required: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roleSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const RoleModel: Model<RoleDoc> =
  (models.Role as Model<RoleDoc>) || model<RoleDoc>("Role", roleSchema);