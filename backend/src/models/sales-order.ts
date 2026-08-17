import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { SalesOrder } from "@erp/shared";

export type SalesOrderDoc = Omit<SalesOrder, "id" | "companyId" | "customerId" | "quoteId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  customerId: Types.ObjectId;
  quoteId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const salesOrderSchema = new Schema<SalesOrderDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", default: null },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          name: { type: String, required: true },
          sku: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
          taxRate: { type: Number, required: true, min: 0 },
          batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
        },
      ],
      required: true,
    },
    totals: {
      subtotal: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["quote", "draft", "confirmed", "paid", "fulfilled", "shipped", "delivered", "cancelled", "refunded"],
      default: "draft",
    },
    shippingAddress: {
      label: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
    },
    notes: { type: String, default: "" },
    idempotencyKey: { type: String, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

salesOrderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true });
salesOrderSchema.index({ companyId: 1, customerId: 1, createdAt: -1 });
salesOrderSchema.index({ companyId: 1, status: 1 });
salesOrderSchema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true });

export const SalesOrderModel: Model<SalesOrderDoc> =
  (mongoose.models.SalesOrder as Model<SalesOrderDoc>) || mongoose.model<SalesOrderDoc>("SalesOrder", salesOrderSchema);