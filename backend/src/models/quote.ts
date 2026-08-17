import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Quote } from "@erp/shared";

export type QuoteDoc = Omit<Quote, "id" | "companyId" | "customerId" | "validUntil"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  customerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  validUntil: Date;
};

const { Schema } = mongoose;

const quoteSchema = new Schema<QuoteDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    quoteNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          name: { type: String, required: true },
          sku: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
          taxRate: { type: Number, required: true, min: 0 },
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
    status: { type: String, enum: ["draft", "sent", "accepted", "declined", "expired", "converted"], default: "draft" },
    validUntil: { type: Date, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

quoteSchema.index({ companyId: 1, quoteNumber: 1 }, { unique: true });
quoteSchema.index({ companyId: 1, customerId: 1, createdAt: -1 });

export const QuoteModel: Model<QuoteDoc> =
  (mongoose.models.Quote as Model<QuoteDoc>) || mongoose.model<QuoteDoc>("Quote", quoteSchema);