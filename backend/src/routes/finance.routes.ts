import { Router } from "express";
import {
  accountSchema,
  accountUpdateSchema,
  expenseClaimSchema,
  expenseClaimStatusSchema,
  expenseSchema,
  expenseUpdateSchema,
  exchangeRateSchema,
  journalEntrySchema,
} from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parseDateRange, parsePagination } from "../utils/pagination";
import {
  aging,
  balanceSheet,
  createAccount,
  createExpense,
  createExpenseClaim,
  createJournalEntry,
  deleteExpense,
  getJournalEntry,
  listAccounts,
  listExchangeRates,
  listExpenseClaims,
  listExpenses,
  listJournalEntries,
  profitAndLoss,
  reverseJournalEntry,
  seedAccounts,
  trialBalance,
  updateAccount,
  updateExpense,
  updateExpenseClaimStatus,
  upsertExchangeRate,
} from "../services/finance.service";

export const financeRouter = Router();

financeRouter.use(auth, tenant);

financeRouter.get("/accounts", rbac("finance:read"), asyncHandler(async (req, res) => {
  res.json(await listAccounts(req.tenantId));
}));

financeRouter.post("/accounts", rbac("finance:write"), validate(accountSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createAccount(req.tenantId, req.userId, req.body));
}));

financeRouter.patch("/accounts/:id", rbac("finance:write"), validate(accountUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateAccount(req.tenantId, req.userId, req.params.id, req.body));
}));

financeRouter.post("/accounts/seed", rbac("finance:write"), asyncHandler(async (req, res) => {
  res.json({ created: await seedAccounts(req.tenantId) });
}));

financeRouter.get("/journal-entries", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listJournalEntries(req.tenantId, {
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/journal-entries", rbac("finance:write"), validate(journalEntrySchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createJournalEntry(req.tenantId, req.userId, req.body));
}));

financeRouter.get("/journal-entries/:id", rbac("finance:read"), asyncHandler(async (req, res) => {
  res.json(await getJournalEntry(req.tenantId, req.params.id));
}));

financeRouter.post("/journal-entries/:id/reverse", rbac("finance:write"), asyncHandler(async (req, res) => {
  res.status(201).json(await reverseJournalEntry(req.tenantId, req.userId, req.params.id));
}));

financeRouter.get("/reports/trial-balance", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  res.json(await trialBalance(req.tenantId, { from: from ? from.toISOString() : undefined, to: to ? to.toISOString() : undefined }));
}));

financeRouter.get("/reports/pnl", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  res.json(await profitAndLoss(req.tenantId, { from: from ? from.toISOString() : undefined, to: to ? to.toISOString() : undefined }));
}));

financeRouter.get("/reports/balance-sheet", rbac("finance:read"), asyncHandler(async (req, res) => {
  res.json(await balanceSheet(req.tenantId, { asOf: typeof req.query.asOf === "string" ? req.query.asOf : undefined }));
}));

financeRouter.get("/reports/aging", rbac("finance:read"), asyncHandler(async (req, res) => {
  res.json(await aging(req.tenantId, { type: req.query.type === "ap" ? "ap" : "ar" }));
}));

financeRouter.get("/expenses", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listExpenses(req.tenantId, {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/expenses", rbac("finance:write"), validate(expenseSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createExpense(req.tenantId, req.userId, req.body));
}));

financeRouter.patch("/expenses/:id", rbac("finance:write"), validate(expenseUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateExpense(req.tenantId, req.userId, req.params.id, req.body));
}));

financeRouter.delete("/expenses/:id", rbac("finance:write"), asyncHandler(async (req, res) => {
  await deleteExpense(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));

financeRouter.get("/expense-claims", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listExpenseClaims(req.tenantId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/expense-claims", rbac("finance:write"), validate(expenseClaimSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createExpenseClaim(req.tenantId, req.userId, req.body));
}));

financeRouter.patch("/expense-claims/:id/status", rbac("approvals:write"), validate(expenseClaimStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateExpenseClaimStatus(req.tenantId, req.userId, req.params.id, req.body.status));
}));

financeRouter.get("/exchange-rates", rbac("finance:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listExchangeRates(req.tenantId, {
      fromCurrency: typeof req.query.fromCurrency === "string" ? req.query.fromCurrency : undefined,
      toCurrency: typeof req.query.toCurrency === "string" ? req.query.toCurrency : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/exchange-rates", rbac("finance:write"), validate(exchangeRateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await upsertExchangeRate(req.tenantId, req.userId, req.body));
}));