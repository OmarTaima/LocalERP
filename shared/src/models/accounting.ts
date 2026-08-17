import type { ID, Money, TenantScoped, Timestamps } from "./common";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense", "contra"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Account = Timestamps &
  TenantScoped & {
    id: ID;
    code: string;
    name: string;
    type: AccountType;
    parentId: ID | null;
    isSystem: boolean;
    currency: string | null;
  };

export type JournalLine = {
  accountId: ID;
  debit: Money;
  credit: Money;
  currency: string;
  fxRate: number;
  description: string;
};

export const JOURNAL_STATUSES = ["posted", "reversed"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export type JournalReference = {
  type: string;
  id: ID;
};

export type JournalEntry = Timestamps &
  TenantScoped & {
    id: ID;
    entryNumber: string;
    date: string;
    description: string;
    reference: JournalReference;
    lines: JournalLine[];
    status: JournalStatus;
    reversedById: ID | null;
    createdBy: ID;
  };