import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Payment } from "@erp/shared";

export type PaymentDoc = Omit<Payment, "id" | "companyId" | "orderId" | "paidAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  orderId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date;
};

const { Schema } = mongoose;

const paymentSchema = new Schema<PaymentDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "SalesOrder", required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["card", "transfer", "cash", "refund"], required: true },
    status: { type: String, enum: ["pending", "captured", "failed", "reversed"], default: "pending" },
    reference: { type: String, default: "" },
    idempotencyKey: { type: String, required: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ companyId: 1, orderId: 1 });
paymentSchema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ companyId: 1, status: 1, paidAt: -1 });

export const PaymentModel: Model<PaymentDoc> =
  (mongoose.models.Payment as Model<PaymentDoc>) || mongoose.model<PaymentDoc>("Payment", paymentSchema);