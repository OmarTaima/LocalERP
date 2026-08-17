import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { PayrollRun } from "@erp/shared";

type PayrollEntryDoc = {
  employeeId: Types.ObjectId;
  gross: number;
  deductions: number;
  tax: number;
  net: number;
  status: "pending" | "paid";
};

export type PayrollRunDoc = Omit<PayrollRun, "id" | "companyId" | "period" | "entries" | "paidAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  period: { month: number; year: number };
  entries: PayrollEntryDoc[];
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const payrollRunSchema = new Schema<PayrollRunDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    period: { month: { type: Number, required: true, min: 1, max: 12 }, year: { type: Number, required: true, min: 2000, max: 2100 } },
    entries: {
      type: [
        {
          employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
          gross: { type: Number, required: true, min: 0 },
          deductions: { type: Number, required: true, min: 0 },
          tax: { type: Number, required: true, min: 0 },
          net: { type: Number, required: true, min: 0 },
          status: { type: String, enum: ["pending", "paid"], default: "pending" },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ["draft", "paid"], default: "draft" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payrollRunSchema.index({ companyId: 1, "period.month": 1, "period.year": 1 }, { unique: true });

export const PayrollRunModel: Model<PayrollRunDoc> =
  (mongoose.models.PayrollRun as Model<PayrollRunDoc>) || mongoose.model<PayrollRunDoc>("PayrollRun", payrollRunSchema);