import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Customer } from "@erp/shared";

export type CustomerDoc = Omit<Customer, "id" | "tenantId" | "segmentId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  segmentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const customerSchema = new Schema<CustomerDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    addresses: {
      type: [
        {
          label: { type: String, required: true },
          street: { type: String, required: true },
          city: { type: String, required: true },
          country: { type: String, required: true },
        },
      ],
      default: [],
    },
    segmentId: { type: Schema.Types.ObjectId, ref: "PriceList", default: null },
    creditLimit: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    totalSpent: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

customerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
customerSchema.index({ tenantId: 1, name: "text", email: "text" });

export const CustomerModel: Model<CustomerDoc> =
  (mongoose.models.Customer as Model<CustomerDoc>) || mongoose.model<CustomerDoc>("Customer", customerSchema);