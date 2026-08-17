import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ExchangeRate } from "@erp/shared";

export type ExchangeRateDoc = Omit<ExchangeRate, "id" | "tenantId" | "date"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const exchangeRateSchema = new Schema<ExchangeRateDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    fromCurrency: { type: String, required: true, uppercase: true },
    toCurrency: { type: String, required: true, uppercase: true },
    rate: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

exchangeRateSchema.index({ tenantId: 1, fromCurrency: 1, toCurrency: 1, date: 1 }, { unique: true });
exchangeRateSchema.index({ tenantId: 1, date: -1 });

export const ExchangeRateModel: Model<ExchangeRateDoc> =
  (mongoose.models.ExchangeRate as Model<ExchangeRateDoc>) ||
  mongoose.model<ExchangeRateDoc>("ExchangeRate", exchangeRateSchema);