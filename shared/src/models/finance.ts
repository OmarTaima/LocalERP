import type { ID, Money, TenantScoped, Timestamps } from "./common";

export type Expense = Timestamps &
  TenantScoped & {
    id: ID;
    description: string;
    amount: Money;
    category: string;
    date: string;
    paidBy: ID;
    receiptUrl: string | null;
  };

export const CLAIM_STATUSES = ["draft", "submitted", "approved", "rejected", "paid"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type ClaimItem = {
  description: string;
  amount: Money;
  date: string;
  receiptUrl?: string;
};

export type ExpenseClaim = Timestamps &
  TenantScoped & {
    id: ID;
    userId: ID;
    items: ClaimItem[];
    total: Money;
    status: ClaimStatus;
    approvalId: ID | null;
  };

export type ExchangeRate = Timestamps &
  TenantScoped & {
    id: ID;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    date: string;
  };