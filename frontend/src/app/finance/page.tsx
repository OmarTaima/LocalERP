"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { useTranslations } from "next-intl";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError, confirmAction, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { useList, useCachedApi, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type Account = { id: string; code: string; name: string; type: string; parentId: string | null; isSystem: boolean; currency: string | null };
type JournalEntry = { id: string; entryNumber: string; date: string; description: string; lines: { debit: number; credit: number }[]; status: string };
type Expense = { id: string; description: string; amount: number; category: string; date: string };
type ExpenseClaim = { id: string; userId: string; total: number; status: string; createdAt: string };
type ExchangeRate = { id: string; fromCurrency: string; toCurrency: string; rate: number; date: string };
type TrialRow = { accountId: string; code: string; name: string; type: string; debit: number; credit: number; balance: number };
type PnlRow = { accountId: string; code: string; name: string; amount: number };

function AccountsTab() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("finance");

  const refresh = () => {
    setLoading(true);
    api<Account[]>("/accounts")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("code"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.code}</Typography> },
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("type"), render: (row) => <Typography sx={{ textTransform: "capitalize", color: "#334155" }}>{row.type}</Typography> },
          { label: t("currency"), render: (row) => row.currency ?? "USD" },
          { label: t("system"), render: (row) => (row.isSystem ? <StatusChip status="active" /> : "—") },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("accountsEmptyTitle")}
        emptySubtitle={t("accountsEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newAccount")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newAccount")}
        fields={[
          { name: "code", label: t("codeField"), required: true },
          { name: "name", label: t("name"), required: true },
          { name: "type", label: t("type"), type: "select", required: true, options: [
            { value: "asset", label: t("typeAsset") }, { value: "liability", label: t("typeLiability") }, { value: "equity", label: t("typeEquity") },
            { value: "revenue", label: t("typeRevenue") }, { value: "expense", label: t("typeExpense") }, { value: "contra", label: t("typeContra") },
          ] },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/accounts", { method: "POST", body: { code: values.code, name: values.name, type: values.type } });
            toastSuccess(t("accountCreated"));
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorCreateAccount"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("createAccount")}
      />
    </>
  );
}

function JournalTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<JournalEntry>("/journal-entries");
  const t = useTranslations("finance");

  const reverse = async (entry: JournalEntry) => {
    const ok = await confirmAction({ title: t("reverseEntryTitle", { entry: entry.entryNumber }), text: t("reverseEntryText"), confirmText: t("reverse") });
    if (!ok) return;
    try {
      await api(`/journal-entries/${entry.id}/reverse`, { method: "POST" });
      toastSuccess(t("entryReversed"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorReverseEntry"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("entry"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.entryNumber}</Typography> },
        { label: t("date"), render: (row) => dateShort(row.date) },
        { label: t("description"), render: (row) => row.description },
        { label: t("debit"), render: (row) => currency(row.lines.reduce((sum, line) => sum + line.debit, 0)) },
        { label: t("credit"), render: (row) => currency(row.lines.reduce((sum, line) => sum + line.credit, 0)) },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("journalEmptyTitle")}
      emptySubtitle={t("journalEmptySubtitle")}
      rowActions={(row) =>
        row.status === "posted" ? (
          <Tooltip title={t("reverse")}>
            <IconButton size="small" color="primary" aria-label={t("reverse")} onClick={() => void reverse(row)}>
              <UndoRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        ) : null
      }
    />
  );
}

function TrialBalanceTab() {
  const { data } = useCachedApi<{ items: TrialRow[]; debitTotal: number; creditTotal: number; balanced: boolean }>("/reports/trial-balance");
  const t = useTranslations("finance");

  return (
    <DataTable
      columns={[
        { label: t("code"), render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.code}</Typography> },
        { label: t("account"), render: (row) => row.name },
        { label: t("type"), render: (row) => <Typography sx={{ textTransform: "capitalize" }}>{row.type}</Typography> },
        { label: t("debit"), render: (row) => currency(row.debit) },
        { label: t("credit"), render: (row) => currency(row.credit) },
        { label: t("balance"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.balance)}</Typography> },
      ]}
      rows={(data?.items ?? []) as (TrialRow & { id: string })[]}
      total={(data?.items ?? []).length}
      page={1}
      onPageChange={() => undefined}
      loading={data === null}
      emptyTitle={t("trialEmptyTitle")}
      emptySubtitle={t("trialEmptySubtitle")}
      actions={
        data ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              {t("debitsCredits", { debits: currency(data.debitTotal), credits: currency(data.creditTotal) })}
            </Typography>
            <StatusChip status={data.balanced ? "active" : "cancelled"} />
          </Stack>
        ) : null
      }
    />
  );
}

function PnlTab() {
  const { data } = useCachedApi<{ revenue: PnlRow[]; expense: PnlRow[]; revenueTotal: number; expenseTotal: number; netIncome: number }>("/reports/pnl");
  const t = useTranslations("finance");

  if (!data) return <EmptyState icon={<AccountBalanceOutlinedIcon />} title={t("loadingStatement")} />;

  const section = (title: string, rows: PnlRow[], total: number, tone: string) => (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3 }}>
      <Typography variant="h6" sx={{ color: "#0f172a", mb: 2 }}>{title}</Typography>
      {rows.length === 0 && <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>{t("noRowsYet", { section: title.toLowerCase() })}</Typography>}
      {rows.map((row) => (
        <Stack key={row.accountId} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: "1px solid #f1f5f9" }}>
          <Typography sx={{ fontSize: 13.5, color: "#334155" }}>{row.code} · {row.name}</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{currency(row.amount)}</Typography>
        </Stack>
      ))}
      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" justifyContent="space-between">
        <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{t("total")}</Typography>
        <Typography sx={{ fontWeight: 700, color: tone }}>{currency(total)}</Typography>
      </Stack>
    </Paper>
  );

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
      {section(t("revenue"), data.revenue, data.revenueTotal, "#059669")}
      {section(t("expenses"), data.expense, data.expenseTotal, "#dc2626")}
      <Paper elevation={0} sx={{ p: 3, border: "1px solid #4f46e5", borderRadius: 3, bgcolor: "#eef2ff" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: 16 }}>{t("netIncome")}</Typography>
          <Typography sx={{ fontWeight: 800, color: data.netIncome >= 0 ? "#059669" : "#dc2626", fontSize: 20 }}>
            {currency(data.netIncome)}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

function ExpensesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Expense>("/expenses");
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("finance");

  return (
    <>
      <DataTable
        columns={[
          { label: t("description"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.description}</Typography> },
          { label: t("category"), render: (row) => row.category },
          { label: t("amount"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.amount)}</Typography> },
          { label: t("date"), render: (row) => dateShort(row.date) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("expensesEmptyTitle")}
        emptySubtitle={t("expensesEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newExpense")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newExpense")}
        fields={[
          { name: "description", label: t("description"), required: true },
          { name: "amount", label: t("amount"), type: "number", required: true },
          { name: "category", label: t("category"), required: true },
          { name: "date", label: t("date"), type: "date", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/expenses", {
              method: "POST",
              body: { description: values.description, amount: Number(values.amount), category: values.category, date: values.date },
            });
            toastSuccess(t("expenseRecorded"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorRecordExpense"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("recordExpense")}
      />
    </>
  );
}

function ExpenseClaimsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ExpenseClaim>("/expense-claims");
  const t = useTranslations("finance");

  const setStatus = async (claim: ExpenseClaim, status: string) => {
    const ok = await confirmAction({ title: t("claimStatusTitle", { status }), text: t("claimStatusText"), confirmText: status });
    if (!ok) return;
    try {
      await api(`/expense-claims/${claim.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(t("claimStatusToast", { status }));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("errorUpdateClaim"));
    }
  };

  return (
    <DataTable
      columns={[
        { label: t("submittedBy"), render: (row) => `#${row.userId.slice(-6)}` },
        { label: t("total"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.total)}</Typography> },
        { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        { label: t("created"), render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle={t("claimsEmptyTitle")}
      emptySubtitle={t("claimsEmptySubtitle")}
      rowActions={(row) =>
        row.status === "submitted" ? (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("approve")}>
              <IconButton size="small" color="success" aria-label={t("approve")} onClick={() => void setStatus(row, "approved")}>
                <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("reject")}>
              <IconButton size="small" color="error" aria-label={t("reject")} onClick={() => void setStatus(row, "rejected")}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null
      }
    />
  );
}

function RatesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ExchangeRate>("/exchange-rates");
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("finance");

  return (
    <>
      <DataTable
        columns={[
          { label: t("from"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.fromCurrency}</Typography> },
          { label: t("to"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.toCurrency}</Typography> },
          { label: t("rate"), render: (row) => row.rate },
          { label: t("date"), render: (row) => dateShort(row.date) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("ratesEmptyTitle")}
        emptySubtitle={t("ratesEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newRate")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newExchangeRate")}
        fields={[
          { name: "fromCurrency", label: t("fromCurrency"), required: true, defaultValue: "EUR" },
          { name: "toCurrency", label: t("toCurrency"), required: true, defaultValue: "USD" },
          { name: "rate", label: t("rate"), type: "number", required: true },
          { name: "date", label: t("date"), type: "date" },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/exchange-rates", {
              method: "POST",
              body: {
                fromCurrency: values.fromCurrency,
                toCurrency: values.toCurrency,
                rate: Number(values.rate),
                ...(values.date ? { date: values.date } : {}),
              },
            });
            toastSuccess(t("rateSaved"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("errorSaveRate"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("saveRate")}
      />
    </>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState(0);
  const t = useTranslations("finance");

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label={t("tabJournal")} />
          <Tab label={t("tabTrialBalance")} />
          <Tab label={t("tabPnl")} />
          <Tab label={t("tabAccounts")} />
          <Tab label={t("tabExpenses")} />
          <Tab label={t("tabClaims")} />
          <Tab label={t("tabExchangeRates")} />
        </Tabs>
      </motion.div>
      {tab === 0 && <JournalTab />}
      {tab === 1 && <TrialBalanceTab />}
      {tab === 2 && <PnlTab />}
      {tab === 3 && <AccountsTab />}
      {tab === 4 && <ExpensesTab />}
      {tab === 5 && <ExpenseClaimsTab />}
      {tab === 6 && <RatesTab />}
    </AppShell>
  );
}