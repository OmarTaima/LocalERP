import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { RecurringInvoice } from "@erp/shared";

export type RecurringInvoiceDoc = Omit<RecurringInvoice, "id" | "companyId" | "customerId" | "nextRunAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  customerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  nextRunAt: Date;
};

const { Schema } = mongoose;

const recurringInvoiceSchema = new Schema<RecurringInvoiceDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    items: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product" },
          name: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
        },
      ],
      required: true,
    },
    interval: { type: String, enum: ["weekly", "monthly", "quarterly", "yearly"], required: true },
    nextRunAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "paused", "cancelled"], default: "active" },
    dayOfPeriod: { type: Number, required: true, min: 1, max: 28 },
  },
  { timestamps: true },
);

recurringInvoiceSchema.index({ companyId: 1, customerId: 1 });
recurringInvoiceSchema.index({ companyId: 1, status: 1, nextRunAt: 1 });

export const RecurringInvoiceModel: Model<RecurringInvoiceDoc> =
  (mongoose.models.RecurringInvoice as Model<RecurringInvoiceDoc>) ||
  mongoose.model<RecurringInvoiceDoc>("RecurringInvoice", recurringInvoiceSchema);