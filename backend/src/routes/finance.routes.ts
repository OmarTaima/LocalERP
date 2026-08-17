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
import { company } from "../middleware/company";
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

financeRouter.use(auth, company);

financeRouter.get("/accounts", rbac("accountant:read"), asyncHandler(async (req, res) => {
  res.json(await listAccounts(req.companyId));
}));

financeRouter.post("/accounts", rbac("accountant:create"), validate(accountSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createAccount(req.companyId, req.userId, req.body));
}));

financeRouter.patch("/accounts/:id", rbac("accountant:write"), validate(accountUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateAccount(req.companyId, req.userId, req.params.id, req.body));
}));

financeRouter.post("/accounts/seed", rbac("accountant:write"), asyncHandler(async (req, res) => {
  res.json({ created: await seedAccounts(req.companyId) });
}));

financeRouter.get("/journal-entries", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listJournalEntries(req.companyId, {
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/journal-entries", rbac("accountant:create"), validate(journalEntrySchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createJournalEntry(req.companyId, req.userId, req.body));
}));

financeRouter.get("/journal-entries/:id", rbac("accountant:read"), asyncHandler(async (req, res) => {
  res.json(await getJournalEntry(req.companyId, req.params.id));
}));

financeRouter.post("/journal-entries/:id/reverse", rbac("accountant:write"), asyncHandler(async (req, res) => {
  res.status(201).json(await reverseJournalEntry(req.companyId, req.userId, req.params.id));
}));

financeRouter.get("/reports/trial-balance", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  res.json(await trialBalance(req.companyId, { from: from ? from.toISOString() : undefined, to: to ? to.toISOString() : undefined }));
}));

financeRouter.get("/reports/pnl", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  res.json(await profitAndLoss(req.companyId, { from: from ? from.toISOString() : undefined, to: to ? to.toISOString() : undefined }));
}));

financeRouter.get("/reports/balance-sheet", rbac("accountant:read"), asyncHandler(async (req, res) => {
  res.json(await balanceSheet(req.companyId, { asOf: typeof req.query.asOf === "string" ? req.query.asOf : undefined }));
}));

financeRouter.get("/reports/aging", rbac("accountant:read"), asyncHandler(async (req, res) => {
  res.json(await aging(req.companyId, { type: req.query.type === "ap" ? "ap" : "ar" }));
}));

financeRouter.get("/expenses", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listExpenses(req.companyId, {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/expenses", rbac("accountant:create"), validate(expenseSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createExpense(req.companyId, req.userId, req.body));
}));

financeRouter.patch("/expenses/:id", rbac("accountant:write"), validate(expenseUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateExpense(req.companyId, req.userId, req.params.id, req.body));
}));

financeRouter.delete("/expenses/:id", rbac("accountant:delete"), asyncHandler(async (req, res) => {
  await deleteExpense(req.companyId, req.userId, req.params.id);
  res.json({ ok: true });
}));

financeRouter.get("/expense-claims", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listExpenseClaims(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/expense-claims", rbac("accountant:create"), validate(expenseClaimSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createExpenseClaim(req.companyId, req.userId, req.body));
}));

financeRouter.patch("/expense-claims/:id/status", rbac("accountant:write"), validate(expenseClaimStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateExpenseClaimStatus(req.companyId, req.userId, req.params.id, req.body.status));
}));

financeRouter.get("/exchange-rates", rbac("accountant:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listExchangeRates(req.companyId, {
      fromCurrency: typeof req.query.fromCurrency === "string" ? req.query.fromCurrency : undefined,
      toCurrency: typeof req.query.toCurrency === "string" ? req.query.toCurrency : undefined,
      page,
      pageSize,
    }),
  );
}));

financeRouter.post("/exchange-rates", rbac("accountant:create"), validate(exchangeRateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await upsertExchangeRate(req.companyId, req.userId, req.body));
}));