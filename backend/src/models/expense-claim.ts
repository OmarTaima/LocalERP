import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ExpenseClaim } from "@erp/shared";

export type ExpenseClaimDoc = Omit<ExpenseClaim, "id" | "companyId" | "userId" | "approvalId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  approvalId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const expenseClaimSchema = new Schema<ExpenseClaimDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [
        {
          description: { type: String, required: true },
          amount: { type: Number, required: true, min: 0 },
          date: { type: Date, required: true },
          receiptUrl: { type: String },
        },
      ],
      required: true,
    },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["draft", "submitted", "approved", "rejected", "paid"], default: "draft" },
    approvalId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

expenseClaimSchema.index({ companyId: 1, status: 1, createdAt: -1 });
expenseClaimSchema.index({ companyId: 1, userId: 1 });

export const ExpenseClaimModel: Model<ExpenseClaimDoc> =
  (mongoose.models.ExpenseClaim as Model<ExpenseClaimDoc>) ||
  mongoose.model<ExpenseClaimDoc>("ExpenseClaim", expenseClaimSchema);