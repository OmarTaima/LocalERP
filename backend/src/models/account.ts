import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Account } from "@erp/shared";

export type AccountDoc = Omit<Account, "id" | "companyId" | "parentId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const accountSchema = new Schema<AccountDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["asset", "liability", "equity", "revenue", "expense", "contra"], required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    isSystem: { type: Boolean, default: false },
    currency: { type: String, default: null },
  },
  { timestamps: true },
);

accountSchema.index({ companyId: 1, code: 1 }, { unique: true });
accountSchema.index({ companyId: 1, type: 1 });

export const AccountModel: Model<AccountDoc> =
  (mongoose.models.Account as Model<AccountDoc>) || mongoose.model<AccountDoc>("Account", accountSchema);

export const DEFAULT_CHART: Array<{ code: string; name: string; type: Account["type"] }> = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Inventory", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Accrued Expenses", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "4100", name: "Sales Discounts", type: "contra" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Operating Expenses", type: "expense" },
  { code: "5200", name: "Tax Payable", type: "liability" },
  { code: "5300", name: "Other Expenses", type: "expense" },
];

export async function seedDefaultAccounts(companyId: string): Promise<number> {
  const count = await AccountModel.countDocuments({ companyId });
  if (count > 0) return 0;
  await AccountModel.insertMany(
    DEFAULT_CHART.map((account) => ({ companyId, ...account, isSystem: true, parentId: null, currency: null })),
  );
  return DEFAULT_CHART.length;
}