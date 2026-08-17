import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Expense } from "@erp/shared";

export type ExpenseDoc = Omit<Expense, "id" | "companyId" | "date" | "paidBy"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  date: Date;
  paidBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const expenseSchema = new Schema<ExpenseDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiptUrl: { type: String, default: null },
  },
  { timestamps: true },
);

expenseSchema.index({ companyId: 1, date: -1 });
expenseSchema.index({ companyId: 1, category: 1 });

export const ExpenseModel: Model<ExpenseDoc> =
  (mongoose.models.Expense as Model<ExpenseDoc>) || mongoose.model<ExpenseDoc>("Expense", expenseSchema);