import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Supplier } from "@erp/shared";

export type SupplierDoc = Omit<Supplier, "id" | "companyId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const supplierSchema = new Schema<SupplierDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    contactName: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    paymentTerms: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplierSchema.index({ companyId: 1, name: "text", email: "text" });

export const SupplierModel: Model<SupplierDoc> =
  (mongoose.models.Supplier as Model<SupplierDoc>) || mongoose.model<SupplierDoc>("Supplier", supplierSchema);