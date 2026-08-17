import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Warehouse } from "@erp/shared";

export type WarehouseDoc = Omit<Warehouse, "id" | "companyId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const warehouseSchema = new Schema<WarehouseDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

warehouseSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const WarehouseModel: Model<WarehouseDoc> =
  (mongoose.models.Warehouse as Model<WarehouseDoc>) || mongoose.model<WarehouseDoc>("Warehouse", warehouseSchema);