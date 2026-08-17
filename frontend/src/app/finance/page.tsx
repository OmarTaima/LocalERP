"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
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
          { label: "Code", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.code}</Typography> },
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Type", render: (row) => <Typography sx={{ textTransform: "capitalize", color: "#334155" }}>{row.type}</Typography> },
          { label: "Currency", render: (row) => row.currency ?? "USD" },
          { label: "System", render: (row) => (row.isSystem ? <StatusChip status="active" /> : "—") },
        ]}
        rows={rows}
        total={rows.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No accounts"
        emptySubtitle="The chart of accounts is seeded automatically"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New account</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New account"
        fields={[
          { name: "code", label: "Code (2-6 digits)", required: true },
          { name: "name", label: "Name", required: true },
          { name: "type", label: "Type", type: "select", required: true, options: [
            { value: "asset", label: "Asset" }, { value: "liability", label: "Liability" }, { value: "equity", label: "Equity" },
            { value: "revenue", label: "Revenue" }, { value: "expense", label: "Expense" }, { value: "contra", label: "Contra" },
          ] },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/accounts", { method: "POST", body: { code: values.code, name: values.name, type: values.type } });
            toastSuccess("Account created");
            setCreateOpen(false);
            refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to create account");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create account"
      />
    </>
  );
}

function JournalTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<JournalEntry>("/journal-entries");

  const reverse = async (entry: JournalEntry) => {
    const ok = await confirmAction({ title: `Reverse ${entry.entryNumber}?`, text: "A reversing entry is posted against the original.", confirmText: "Reverse" });
    if (!ok) return;
    try {
      await api(`/journal-entries/${entry.id}/reverse`, { method: "POST" });
      toastSuccess("Entry reversed");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to reverse entry");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "Entry", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.entryNumber}</Typography> },
        { label: "Date", render: (row) => dateShort(row.date) },
        { label: "Description", render: (row) => row.description },
        { label: "Debit", render: (row) => currency(row.lines.reduce((sum, line) => sum + line.debit, 0)) },
        { label: "Credit", render: (row) => currency(row.lines.reduce((sum, line) => sum + line.credit, 0)) },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No journal entries"
      emptySubtitle="Sales, payments, expenses and work orders post here"
      rowActions={(row) =>
        row.status === "posted" ? <Button size="small" variant="outlined" color="error" onClick={() => void reverse(row)}>Reverse</Button> : null
      }
    />
  );
}

function TrialBalanceTab() {
  const { data } = useCachedApi<{ items: TrialRow[]; debitTotal: number; creditTotal: number; balanced: boolean }>("/reports/trial-balance");

  return (
    <DataTable
      columns={[
        { label: "Code", render: (row) => <Typography sx={{ fontWeight: 600, color: "#4f46e5" }}>{row.code}</Typography> },
        { label: "Account", render: (row) => row.name },
        { label: "Type", render: (row) => <Typography sx={{ textTransform: "capitalize" }}>{row.type}</Typography> },
        { label: "Debit", render: (row) => currency(row.debit) },
        { label: "Credit", render: (row) => currency(row.credit) },
        { label: "Balance", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.balance)}</Typography> },
      ]}
      rows={(data?.items ?? []) as (TrialRow & { id: string })[]}
      total={(data?.items ?? []).length}
      page={1}
      onPageChange={() => undefined}
      loading={data === null}
      emptyTitle="No posted entries"
      emptySubtitle="Totals appear once journal entries are posted"
      actions={
        data ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              Debits {currency(data.debitTotal)} · Credits {currency(data.creditTotal)}
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

  if (!data) return <EmptyState icon={<AccountBalanceOutlinedIcon />} title="Loading statement…" />;

  const section = (title: string, rows: PnlRow[], total: number, tone: string) => (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid #e2e8f0", borderRadius: 3 }}>
      <Typography variant="h6" sx={{ color: "#0f172a", mb: 2 }}>{title}</Typography>
      {rows.length === 0 && <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No {title.toLowerCase()} yet.</Typography>}
      {rows.map((row) => (
        <Stack key={row.accountId} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: "1px solid #f1f5f9" }}>
          <Typography sx={{ fontSize: 13.5, color: "#334155" }}>{row.code} · {row.name}</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{currency(row.amount)}</Typography>
        </Stack>
      ))}
      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" justifyContent="space-between">
        <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>Total</Typography>
        <Typography sx={{ fontWeight: 700, color: tone }}>{currency(total)}</Typography>
      </Stack>
    </Paper>
  );

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
      {section("Revenue", data.revenue, data.revenueTotal, "#059669")}
      {section("Expenses", data.expense, data.expenseTotal, "#dc2626")}
      <Paper elevation={0} sx={{ p: 3, border: "1px solid #4f46e5", borderRadius: 3, bgcolor: "#eef2ff" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: 16 }}>Net income</Typography>
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

  return (
    <>
      <DataTable
        columns={[
          { label: "Description", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.description}</Typography> },
          { label: "Category", render: (row) => row.category },
          { label: "Amount", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.amount)}</Typography> },
          { label: "Date", render: (row) => dateShort(row.date) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No expenses"
        emptySubtitle="Expenses post a journal entry to the expense and cash accounts"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New expense</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New expense"
        fields={[
          { name: "description", label: "Description", required: true },
          { name: "amount", label: "Amount", type: "number", required: true },
          { name: "category", label: "Category", required: true },
          { name: "date", label: "Date", type: "date", required: true },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/expenses", {
              method: "POST",
              body: { description: values.description, amount: Number(values.amount), category: values.category, date: values.date },
            });
            toastSuccess("Expense recorded");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to record expense");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Record expense"
      />
    </>
  );
}

function ExpenseClaimsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ExpenseClaim>("/expense-claims");

  const setStatus = async (claim: ExpenseClaim, status: string) => {
    const ok = await confirmAction({ title: `${status} this claim?`, text: "Approved claims are paid and journaled.", confirmText: status });
    if (!ok) return;
    try {
      await api(`/expense-claims/${claim.id}/status`, { method: "PATCH", body: { status } });
      toastSuccess(`Claim ${status}`);
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "failed to update claim");
    }
  };

  return (
    <DataTable
      columns={[
        { label: "Submitted by", render: (row) => `#${row.userId.slice(-6)}` },
        { label: "Total", render: (row) => <Typography sx={{ fontWeight: 600 }}>{currency(row.total)}</Typography> },
        { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        { label: "Created", render: (row) => dateShort(row.createdAt) },
      ]}
      rows={rows}
      total={total}
      page={page}
      onPageChange={setPage}
      loading={loading}
      emptyTitle="No expense claims"
      emptySubtitle="Team expense claims appear here for approval"
      rowActions={(row) =>
        row.status === "submitted" ? (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="contained" onClick={() => void setStatus(row, "approved")}>Approve</Button>
            <Button size="small" variant="outlined" color="error" onClick={() => void setStatus(row, "rejected")}>Reject</Button>
          </Stack>
        ) : null
      }
    />
  );
}

function RatesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ExchangeRate>("/exchange-rates");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "From", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.fromCurrency}</Typography> },
          { label: "To", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.toCurrency}</Typography> },
          { label: "Rate", render: (row) => row.rate },
          { label: "Date", render: (row) => dateShort(row.date) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No exchange rates"
        emptySubtitle="Rates power multi-currency journals and revaluation"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New rate</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New exchange rate"
        fields={[
          { name: "fromCurrency", label: "From currency", required: true, defaultValue: "EUR" },
          { name: "toCurrency", label: "To currency", required: true, defaultValue: "USD" },
          { name: "rate", label: "Rate", type: "number", required: true },
          { name: "date", label: "Date", type: "date" },
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
            toastSuccess("Exchange rate saved");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "failed to save rate");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Save rate"
      />
    </>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState(0);

  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Accounting" subtitle="Track income, expenses and the money in your accounts." />
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          <Tab label="Journal" />
          <Tab label="Trial balance" />
          <Tab label="P&L" />
          <Tab label="Accounts" />
          <Tab label="Expenses" />
          <Tab label="Claims" />
          <Tab label="Exchange rates" />
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