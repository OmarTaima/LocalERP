import mongoose from "mongoose";
import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { nextNumber } from "../models/counter";
import {
  AccountModel,
  ExchangeRateModel,
  ExpenseClaimModel,
  ExpenseModel,
  JournalEntryModel,
  seedDefaultAccounts,
  type AccountDoc,
  type ExpenseClaimDoc,
  type ExpenseDoc,
  type ExchangeRateDoc,
  type JournalEntryDoc,
} from "../models";

export async function listAccounts(tenantId: string) {
  await seedDefaultAccounts(tenantId);
  const docs = await AccountModel.find({ tenantId }).sort({ code: 1 }).lean();
  return docs.map(serializeAccount);
}

function serializeAccount(doc: AccountDoc) {
  return {
    id: doc._id.toString(),
    code: doc.code,
    name: doc.name,
    type: doc.type,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    isSystem: doc.isSystem,
    currency: doc.currency,
  };
}

export async function createAccount(tenantId: string, userId: string, input: { code: string; name: string; type: AccountDoc["type"]; parentId?: string | null; currency?: string | null }) {
  if (input.parentId) {
    const parent = await AccountModel.findOne({ _id: input.parentId, tenantId });
    if (!parent) throw new AppError(400, "parent account does not exist");
  }
  const doc = await AccountModel.create({
    tenantId,
    code: input.code,
    name: input.name,
    type: input.type,
    parentId: input.parentId ?? null,
    isSystem: false,
    currency: input.currency ?? null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Account", entityId: doc._id.toString(), after: { code: doc.code, name: doc.name } });
  return serializeAccount(doc);
}

export async function updateAccount(tenantId: string, userId: string, accountId: string, input: { name?: string; parentId?: string | null; currency?: string | null }) {
  const doc = await AccountModel.findOne({ _id: accountId, tenantId });
  if (!doc) throw new AppError(404, "account not found");
  if (doc.isSystem && input.parentId !== undefined) throw new AppError(400, "system accounts cannot be reparented");
  if (input.name !== undefined) doc.name = input.name;
  if (input.parentId !== undefined) {
    if (input.parentId && input.parentId === accountId) throw new AppError(400, "account cannot be its own parent");
    if (input.parentId) {
      const parent = await AccountModel.findOne({ _id: input.parentId, tenantId });
      if (!parent) throw new AppError(400, "parent account does not exist");
    }
    doc.parentId = input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null;
  }
  if (input.currency !== undefined) doc.currency = input.currency;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Account", entityId: accountId, after: { name: doc.name } });
  return serializeAccount(doc);
}

export async function seedAccounts(tenantId: string): Promise<number> {
  return seedDefaultAccounts(tenantId);
}

export type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  currency?: string;
  fxRate?: number;
  description?: string;
};

export async function createJournalEntry(
  tenantId: string,
  userId: string,
  input: { date: string; description: string; reference: { type: string; id: string }; lines: JournalLineInput[] },
) {
  const accountIds = input.lines.map((line) => line.accountId);
  const accounts = await AccountModel.find({ _id: { $in: accountIds }, tenantId }).lean();
  if (accounts.length !== new Set(accountIds).size) throw new AppError(400, "one or more accounts do not exist");
  const doc = await JournalEntryModel.create({
    tenantId,
    entryNumber: await nextNumber(tenantId, "journal", "JE"),
    date: new Date(input.date),
    description: input.description,
    reference: input.reference,
    lines: input.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      currency: line.currency ?? "USD",
      fxRate: line.fxRate ?? 1,
      description: line.description ?? "",
    })),
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "JournalEntry", entityId: doc._id.toString(), after: { entryNumber: doc.entryNumber, amount: input.lines.reduce((sum, line) => sum + line.debit, 0) } });
  publish({ type: "finance.journal.posted", payload: { tenantId, entryId: doc._id.toString(), entryNumber: doc.entryNumber } });
  return serializeJournalEntry(doc);
}

function serializeJournalEntry(doc: JournalEntryDoc) {
  return {
    id: doc._id.toString(),
    entryNumber: doc.entryNumber,
    date: doc.date.toISOString(),
    description: doc.description,
    reference: doc.reference,
    lines: doc.lines.map((line) => ({
      accountId: line.accountId.toString(),
      debit: line.debit,
      credit: line.credit,
      currency: line.currency,
      fxRate: line.fxRate,
      description: line.description,
    })),
    status: doc.status,
    reversedById: doc.reversedById ? doc.reversedById.toString() : null,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function getJournalEntry(tenantId: string, entryId: string) {
  const doc = await JournalEntryModel.findOne({ _id: entryId, tenantId });
  if (!doc) throw new AppError(404, "journal entry not found");
  return serializeJournalEntry(doc);
}

export async function listJournalEntries(tenantId: string, query: { from?: string; to?: string; accountId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  if (query.accountId) filter["lines.accountId"] = query.accountId;
  const [docs, total] = await Promise.all([
    JournalEntryModel.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    JournalEntryModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeJournalEntry), total, page, pageSize };
}

export async function reverseJournalEntry(tenantId: string, userId: string, entryId: string) {
  const original = await JournalEntryModel.findOne({ _id: entryId, tenantId });
  if (!original) throw new AppError(404, "journal entry not found");
  if (original.status === "reversed") throw new AppError(400, "entry already reversed");
  const reversal = await JournalEntryModel.create({
    tenantId,
    entryNumber: await nextNumber(tenantId, "journal", "JE"),
    date: new Date(),
    description: `Reversal of ${original.entryNumber}`,
    reference: original.reference,
    lines: original.lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit })),
    status: "posted",
    reversedById: original._id,
    createdBy: userId,
  });
  original.status = "reversed";
  original.reversedById = reversal._id;
  await original.save();
  await writeAudit({ tenantId, userId, action: "create", entity: "JournalEntry", entityId: reversal._id.toString(), after: { entryNumber: reversal.entryNumber, note: "reversal" } });
  publish({ type: "finance.journal.reversed", payload: { tenantId, entryId: original._id.toString(), reversalId: reversal._id.toString() } });
  return serializeJournalEntry(reversal);
}

function postedEntriesFilter(tenantId: string, from?: string, to?: string, asOf?: string) {
  const filter: Record<string, unknown> = { tenantId, status: "posted" };
  if (asOf) filter.date = { $lte: new Date(asOf) };
  else if (from || to) {
    filter.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }
  return filter;
}

export async function trialBalance(tenantId: string, query: { from?: string; to?: string }) {
  await seedDefaultAccounts(tenantId);
  const rows = await JournalEntryModel.aggregate([
    { $match: postedEntriesFilter(tenantId, query.from, query.to) },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.accountId",
        debit: { $sum: "$lines.debit" },
        credit: { $sum: "$lines.credit" },
      },
    },
  ]);
  const accountIds = rows.map((row) => row._id);
  const accounts = await AccountModel.find({ _id: { $in: accountIds }, tenantId }).lean();
  const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));
  const items = rows
    .map((row) => {
      const account = accountMap.get(row._id.toString());
      if (!account) return null;
      return {
        accountId: row._id.toString(),
        code: account.code,
        name: account.name,
        type: account.type,
        debit: row.debit,
        credit: row.credit,
        balance: row.debit - row.credit,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.code.localeCompare(b.code));
  const debitTotal = items.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = items.reduce((sum, row) => sum + row.credit, 0);
  return { items, debitTotal: round2(debitTotal), creditTotal: round2(creditTotal), balanced: Math.abs(debitTotal - creditTotal) < 0.01 };
}

export async function profitAndLoss(tenantId: string, query: { from?: string; to?: string }) {
  const entries = await JournalEntryModel.find(postedEntriesFilter(tenantId, query.from, query.to)).lean();
  const accountIds = new Set(entries.flatMap((entry) => entry.lines.map((line) => line.accountId.toString())));
  const accounts = await AccountModel.find({ _id: { $in: [...accountIds] }, tenantId }).lean();
  const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = byAccount.get(line.accountId.toString()) ?? { debit: 0, credit: 0 };
      current.debit += line.debit;
      current.credit += line.credit;
      byAccount.set(line.accountId.toString(), current);
    }
  }
  const revenue: Array<{ accountId: string; code: string; name: string; amount: number }> = [];
  const expense: Array<{ accountId: string; code: string; name: string; amount: number }> = [];
  let revenueTotal = 0;
  let expenseTotal = 0;
  for (const [accountId, totals] of byAccount) {
    const account = accountMap.get(accountId);
    if (!account) continue;
    if (account.type === "revenue") {
      const amount = round2(totals.credit - totals.debit);
      revenue.push({ accountId, code: account.code, name: account.name, amount });
      revenueTotal += amount;
    } else if (account.type === "expense") {
      const amount = round2(totals.debit - totals.credit);
      expense.push({ accountId, code: account.code, name: account.name, amount });
      expenseTotal += amount;
    }
  }
  revenue.sort((a, b) => a.code.localeCompare(b.code));
  expense.sort((a, b) => a.code.localeCompare(b.code));
  return {
    revenue,
    expense,
    revenueTotal: round2(revenueTotal),
    expenseTotal: round2(expenseTotal),
    netIncome: round2(revenueTotal - expenseTotal),
  };
}

export async function balanceSheet(tenantId: string, query: { asOf?: string }) {
  const entries = await JournalEntryModel.find(postedEntriesFilter(tenantId, undefined, undefined, query.asOf)).lean();
  const accountIds = new Set(entries.flatMap((entry) => entry.lines.map((line) => line.accountId.toString())));
  const accounts = await AccountModel.find({ _id: { $in: [...accountIds] }, tenantId }).lean();
  const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));
  const balances = new Map<string, number>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      balances.set(line.accountId.toString(), (balances.get(line.accountId.toString()) ?? 0) + line.debit - line.credit);
    }
  }
  const assets = [] as Array<{ accountId: string; code: string; name: string; amount: number }>;
  const liabilities = [] as Array<{ accountId: string; code: string; name: string; amount: number }>;
  const equity = [] as Array<{ accountId: string; code: string; name: string; amount: number }>;
  let netIncome = 0;
  for (const [accountId, net] of balances) {
    const account = accountMap.get(accountId);
    if (!account) continue;
    if (account.type === "asset") {
      if (round2(net) !== 0) assets.push({ accountId, code: account.code, name: account.name, amount: round2(net) });
    } else if (account.type === "liability") {
      if (round2(-net) !== 0) liabilities.push({ accountId, code: account.code, name: account.name, amount: round2(-net) });
    } else if (account.type === "equity") {
      if (round2(-net) !== 0) equity.push({ accountId, code: account.code, name: account.name, amount: round2(-net) });
    } else if (account.type === "revenue" || account.type === "expense") {
      netIncome -= net;
    }
  }
  assets.sort((a, b) => a.code.localeCompare(b.code));
  liabilities.sort((a, b) => a.code.localeCompare(b.code));
  equity.sort((a, b) => a.code.localeCompare(b.code));
  const assetTotal = round2(assets.reduce((sum, row) => sum + row.amount, 0));
  const liabilityTotal = round2(liabilities.reduce((sum, row) => sum + row.amount, 0));
  const equityTotal = round2(equity.reduce((sum, row) => sum + row.amount, 0) + round2(netIncome));
  return {
    asOf: query.asOf ?? new Date().toISOString(),
    assets,
    liabilities,
    equity,
    assetTotal,
    liabilityTotal,
    equityTotal,
    retainedEarnings: round2(netIncome),
    balanced: Math.abs(assetTotal - (liabilityTotal + equityTotal)) < 0.01,
  };
}

export async function aging(tenantId: string, query: { type: "ar" | "ap" }) {
  const ar = query.type === "ar";
  const account = await AccountModel.findOne({ tenantId, code: ar ? "1100" : "2000" });
  if (!account) return { type: query.type, buckets: { current: [], days31to60: [], days61to90: [], days91plus: [] }, totals: { current: 0, days31to60: 0, days61to90: 0, days91plus: 0 } };
  const referenceType = ar ? "order" : "purchase-order";
  const entries = await JournalEntryModel.find({ tenantId, status: "posted", "reference.type": referenceType, "lines.accountId": account._id }).sort({ date: 1 }).lean();
  const now = Date.now();
  const buckets: Record<string, Array<{ reference: string; amount: number; date: string }>> = {
    current: [],
    days31to60: [],
    days61to90: [],
    days91plus: [],
  };
  const totals = { current: 0, days31to60: 0, days61to90: 0, days91plus: 0 };
  for (const entry of entries) {
    const line = entry.lines.find((l) => l.accountId.toString() === account._id.toString());
    if (!line) continue;
    const amount = ar ? line.debit - line.credit : line.credit - line.debit;
    if (amount <= 0) continue;
    const ageDays = Math.max(0, Math.floor((now - entry.date.getTime()) / (24 * 60 * 60 * 1000)));
    const bucket = ageDays <= 30 ? "current" : ageDays <= 60 ? "days31to60" : ageDays <= 90 ? "days61to90" : "days91plus";
    buckets[bucket].push({ reference: entry.reference.id, amount: round2(amount), date: entry.date.toISOString() });
    totals[bucket] = round2(totals[bucket] + amount);
  }
  return { type: query.type, buckets, totals };
}

export async function listExpenses(tenantId: string, query: { category?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.category) filter.category = query.category;
  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  const [docs, total] = await Promise.all([
    ExpenseModel.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ExpenseModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeExpense), total, page, pageSize };
}

function serializeExpense(doc: ExpenseDoc) {
  return {
    id: doc._id.toString(),
    description: doc.description,
    amount: doc.amount,
    category: doc.category,
    date: doc.date.toISOString(),
    paidBy: doc.paidBy.toString(),
    receiptUrl: doc.receiptUrl,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createExpense(tenantId: string, userId: string, input: { description: string; amount: number; category: string; date: string; receiptUrl?: string | null }) {
  const doc = await ExpenseModel.create({
    tenantId,
    description: input.description,
    amount: input.amount,
    category: input.category,
    date: new Date(input.date),
    paidBy: userId,
    receiptUrl: input.receiptUrl ?? null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Expense", entityId: doc._id.toString(), after: { description: doc.description, amount: doc.amount } });
  const entry = await postExpenseJournal(tenantId, userId, doc);
  publish({ type: "finance.expense.created", payload: { tenantId, expenseId: doc._id.toString(), amount: doc.amount } });
  return { ...serializeExpense(doc), journalEntryId: entry?.id ?? null };
}

async function postExpenseJournal(tenantId: string, userId: string, expense: ExpenseDoc) {
  const expenseAccount = await AccountModel.findOne({ tenantId, code: "5100" });
  const cashAccount = await AccountModel.findOne({ tenantId, code: "1000" });
  if (!expenseAccount || !cashAccount) return null;
  const doc = await JournalEntryModel.create({
    tenantId,
    entryNumber: await nextNumber(tenantId, "journal", "JE"),
    date: expense.date,
    description: `Expense: ${expense.description}`,
    reference: { type: "expense", id: expense._id.toString() },
    lines: [
      { accountId: expenseAccount._id, debit: expense.amount, credit: 0, currency: "USD", fxRate: 1, description: expense.category },
      { accountId: cashAccount._id, debit: 0, credit: expense.amount, currency: "USD", fxRate: 1, description: "expense payment" },
    ],
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  return { id: doc._id.toString(), entryNumber: doc.entryNumber };
}

export async function updateExpense(tenantId: string, userId: string, expenseId: string, input: Record<string, unknown>) {
  const doc = await ExpenseModel.findOne({ _id: expenseId, tenantId });
  if (!doc) throw new AppError(404, "expense not found");
  const before = { description: doc.description, amount: doc.amount, category: doc.category };
  for (const [key, value] of Object.entries(input)) {
    if (key === "date") {
      doc.date = new Date(value as string);
    } else {
      (doc as unknown as Record<string, unknown>)[key] = value;
    }
  }
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Expense", entityId: expenseId, before, after: { description: doc.description, amount: doc.amount } });
  return serializeExpense(doc);
}

export async function deleteExpense(tenantId: string, userId: string, expenseId: string): Promise<void> {
  const doc = await ExpenseModel.findOne({ _id: expenseId, tenantId });
  if (!doc) throw new AppError(404, "expense not found");
  await writeAudit({ tenantId, userId, action: "delete", entity: "Expense", entityId: expenseId, before: { description: doc.description, amount: doc.amount } });
  await doc.deleteOne();
}

export async function createExpenseClaim(tenantId: string, userId: string, input: { items: Array<{ description: string; amount: number; date: string; receiptUrl?: string }> }) {
  const total = round2(input.items.reduce((sum, item) => sum + item.amount, 0));
  const doc = await ExpenseClaimModel.create({
    tenantId,
    userId,
    items: input.items.map((item) => ({ ...item, date: new Date(item.date) })),
    total,
    status: "draft",
    approvalId: null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "ExpenseClaim", entityId: doc._id.toString(), after: { total: doc.total } });
  return serializeExpenseClaim(doc);
}

function serializeExpenseClaim(doc: ExpenseClaimDoc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    items: doc.items.map((item) => ({ description: item.description, amount: item.amount, date: new Date(item.date).toISOString(), receiptUrl: item.receiptUrl })),
    total: doc.total,
    status: doc.status,
    approvalId: doc.approvalId ? doc.approvalId.toString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listExpenseClaims(tenantId: string, query: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    ExpenseClaimModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ExpenseClaimModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeExpenseClaim), total, page, pageSize };
}

export async function updateExpenseClaimStatus(tenantId: string, userId: string, claimId: string, status: "submitted" | "approved" | "rejected" | "paid") {
  const doc = await ExpenseClaimModel.findOne({ _id: claimId, tenantId });
  if (!doc) throw new AppError(404, "expense claim not found");
  const allowed: Record<string, string[]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["paid"],
    rejected: [],
    paid: [],
  };
  if (!allowed[doc.status].includes(status)) throw new AppError(400, `cannot move claim from ${doc.status} to ${status}`);
  if (status === "approved") doc.approvalId = new mongoose.Types.ObjectId(userId);
  doc.status = status;
  await doc.save();
  if (status === "paid") {
    await postClaimJournal(tenantId, userId, doc);
  }
  await writeAudit({ tenantId, userId, action: "update", entity: "ExpenseClaim", entityId: claimId, after: { status: doc.status } });
  return serializeExpenseClaim(doc);
}

async function postClaimJournal(tenantId: string, userId: string, claim: ExpenseClaimDoc) {
  const expenseAccount = await AccountModel.findOne({ tenantId, code: "5100" });
  const cashAccount = await AccountModel.findOne({ tenantId, code: "1000" });
  if (!expenseAccount || !cashAccount) return null;
  const doc = await JournalEntryModel.create({
    tenantId,
    entryNumber: await nextNumber(tenantId, "journal", "JE"),
    date: new Date(),
    description: `Expense claim payout ${claim._id.toString()}`,
    reference: { type: "expense-claim", id: claim._id.toString() },
    lines: [
      { accountId: expenseAccount._id, debit: claim.total, credit: 0, currency: "USD", fxRate: 1, description: "claim payout" },
      { accountId: cashAccount._id, debit: 0, credit: claim.total, currency: "USD", fxRate: 1, description: "claim payout" },
    ],
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  return { id: doc._id.toString(), entryNumber: doc.entryNumber };
}

export async function upsertExchangeRate(tenantId: string, userId: string, input: { fromCurrency: string; toCurrency: string; rate: number; date?: string }) {
  const date = input.date ? new Date(input.date) : new Date();
  const doc = await ExchangeRateModel.findOneAndUpdate(
    { tenantId, fromCurrency: input.fromCurrency, toCurrency: input.toCurrency, date },
    { rate: input.rate },
    { new: true, upsert: true },
  );
  await writeAudit({ tenantId, userId, action: "create", entity: "ExchangeRate", entityId: doc._id.toString(), after: { from: doc.fromCurrency, to: doc.toCurrency, rate: doc.rate } });
  return serializeExchangeRate(doc);
}

function serializeExchangeRate(doc: ExchangeRateDoc) {
  return {
    id: doc._id.toString(),
    fromCurrency: doc.fromCurrency,
    toCurrency: doc.toCurrency,
    rate: doc.rate,
    date: doc.date.toISOString(),
  };
}

export async function listExchangeRates(tenantId: string, query: { fromCurrency?: string; toCurrency?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.fromCurrency) filter.fromCurrency = query.fromCurrency;
  if (query.toCurrency) filter.toCurrency = query.toCurrency;
  const [docs, total] = await Promise.all([
    ExchangeRateModel.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ExchangeRateModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeExchangeRate), total, page, pageSize };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}