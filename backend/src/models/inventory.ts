import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Inventory } from "@erp/shared";

export type InventoryDoc = Omit<Inventory, "id" | "companyId" | "productId" | "warehouseId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const inventorySchema = new Schema<InventoryDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

inventorySchema.index({ companyId: 1, productId: 1, warehouseId: 1 }, { unique: true });
inventorySchema.index({ companyId: 1, quantity: 1 });

export const InventoryModel: Model<InventoryDoc> =
  (mongoose.models.Inventory as Model<InventoryDoc>) || mongoose.model<InventoryDoc>("Inventory", inventorySchema);