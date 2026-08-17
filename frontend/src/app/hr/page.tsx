"use client"

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

type Department = { id: string; name: string; parentId: string | null; headUserId: string | null; childCount: number };
type Employee = { id: string; userId: string | null; name: string; email: string; departmentId: string; departmentName: string; position: string; salary: number; hireDate: string; status: string };
type ShiftPattern = { id: string; name: string; startTime: string; endTime: string; days: number[] };
type PayrollEntry = { employeeId: string; gross: number; deductions: number; tax: number; net: number; status: string };
type PayrollRun = { id: string; period: { month: number; year: number }; entries: PayrollEntry[]; status: string; paidAt: string | null };
type AttendanceRow = { id: string; employeeId: string; date: string; status: string; shiftPatternId: string | null };

const EMPLOYEE_STATUSES = ["active", "onLeave", "terminated"];
const EMPLOYEE_STATUS_KEYS: Record<string, string> = { active: "statusActive", onLeave: "statusOnLeave", terminated: "statusTerminated" };
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function DepartmentsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Department>("/departments");
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("hr");

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("deptColumnParent"), render: (row) => row.parentId ? "#" + row.parentId.slice(-6) : "-" },
          { label: t("deptColumnChildren"), render: (row) => String(row.childCount) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("deptEmptyTitle")}
        emptySubtitle={t("deptEmptySubtitle")}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newDepartment")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={t("newDepartment")}
        fields={[{ name: "name", label: t("name"), required: true }]}
        onSubmit={async (values) => {
          try {
            await api("/departments", { method: "POST", body: { name: values.name } });
            toastSuccess(t("deptCreated"));
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("deptCreateFailed"));
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel={t("create")}
      />
    </>
  );
}

function EmployeesTab() {
  const { rows: departments } = useList<Department>("/departments", { pageSize: 100 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const t = useTranslations("hr");

  const fetchData = (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api<{ items: Employee[]; total: number }>("/employees?" + params.toString())
      .then((res) => { setEmployees(res.items); setTotal(res.total); })
      .catch(() => { setEmployees([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page); }, [page, search, statusFilter]);

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "#id:" + id.slice(-6);
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  const handleSubmit = async (values: Record<string, string | number>) => {
    const body: Record<string, unknown> = {
      name: values.name, email: values.email, departmentId: values.departmentId,
      position: values.position, salary: Number(values.salary), hireDate: String(values.hireDate),
    };
    if (values.status) body.status = values.status;
    if (values.userId) body.userId = values.userId;
try {
      if (editing) {
        await api("/employees/" + editing.id, { method: "PATCH", body });
        toastSuccess(t("employeeUpdated"));
      } else {
        await api("/employees", { method: "POST", body });
        toastSuccess(t("employeeCreated"));
      }
      setCreateOpen(false); setEditing(null);
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("employeeSaveFailed"));
    }
  };

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
<TextField
          size="small"
          placeholder={t("searchEmployeesPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 240 }}
        />
        <TextField
          size="small"
          select
          label={t("status")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ width: 160 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {EMPLOYEE_STATUSES.map((s) => <MenuItem key={s} value={s}>{t(EMPLOYEE_STATUS_KEYS[s])}</MenuItem>)}
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("employeeColumnDepartment"), render: (row) => deptName(row.departmentId) },
          { label: t("employeeColumnPosition"), render: (row) => row.position },
          { label: t("employeeColumnSalary"), render: (row) => currency(row.salary) },
          { label: t("employeeColumnHireDate"), render: (row) => dateShort(row.hireDate) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={employees}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("employeeEmptyTitle")}
        emptySubtitle={t("employeeEmptySubtitle")}
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("editAria", { name: row.name })}>
              <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => { setEditing(row); setCreateOpen(true); }}>
                <EditOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newEmployee")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={editing ? editing.name : t("newEmployee")}
        fields={[
          { name: "name", label: t("employeeFullName"), required: true, defaultValue: editing?.name },
          { name: "email", label: t("email"), required: true, defaultValue: editing?.email },
          { name: "departmentId", label: t("employeeColumnDepartment"), type: "select", required: true, options: deptOptions, defaultValue: editing?.departmentId },
          { name: "position", label: t("employeeColumnPosition"), required: true, defaultValue: editing?.position },
          { name: "salary", label: t("employeeColumnSalary"), type: "number", required: true, defaultValue: editing?.salary },
          { name: "hireDate", label: t("employeeColumnHireDate"), type: "date", required: true, defaultValue: editing?.hireDate },
        ]}
        onSubmit={handleSubmit}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        submitLabel={editing ? t("save") : t("create")}
      />
    </>
  );
}

function AttendanceTab() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
const [loading, setLoading] = useState(false);
  const { rows: employees } = useList<Employee>("/employees?pageSize=100");
  const t = useTranslations("hr");

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? "#id:" + id.slice(-6);

  const fetchMonth = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ month: String(month), year: String(year) });
      const data = await api<AttendanceRow[]>("/attendance?" + q.toString());
      setAttendance(data.map((r, i) => ({ ...r, id: r.id ?? "att-" + i })));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("attendanceLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchMonth(); }, [month, year]);

  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const onLeave = attendance.filter((a) => a.status === "leave").length;

  return (
    <>
<Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <TextField size="small" type="number" label={t("month")} value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ width: 110 }} inputProps={{ min: 1, max: 12 }} />
        <TextField size="small" type="number" label={t("year")} value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ width: 110 }} inputProps={{ min: 2000 }} />
        <Typography sx={{ color: "#64748b", fontSize: 13 }}>{t("attendanceSummary", { present, absent, late, onLeave })}</Typography>
      </Stack>
      <DataTable
        columns={[
          { label: t("employee"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{empName(row.employeeId)}</Typography> },
          { label: t("date"), render: (row) => dateShort(row.date) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
          { label: t("shift"), render: (row) => row.shiftPatternId ? "shift:" + row.shiftPatternId.slice(-6) : "-" },
        ]}
        rows={attendance}
        total={attendance.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle={t("attendanceEmptyTitle")}
        emptySubtitle={t("attendanceEmptySubtitle")}
      />
    </>
  );
}

function TimesheetsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<{
    id: string; employeeName: string; date: string; hours: number; project: string; status: string;
  }>("/timesheets", { pageSize: 20 });
const [actionOpen, setActionOpen] = useState(false);
  const [actingOn, setActingOn] = useState<{ id: string; approved: boolean } | null>(null);
  const t = useTranslations("hr");

  const handleApprove = (id: string, approved: boolean) => { setActingOn({ id, approved }); setActionOpen(true); };

  return (
    <>
      <DataTable
        columns={[
          { label: t("date"), render: (row) => dateShort(row.date) },
          { label: t("employee"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.employeeName}</Typography> },
          { label: t("timesheetColumnProject"), render: (row) => row.project },
          { label: t("timesheetColumnHours"), render: (row) => String(row.hours) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("timesheetEmptyTitle")}
        emptySubtitle={t("timesheetEmptySubtitle")}
        rowActions={(row) =>
          row.status === "submitted" ? (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("approve")}>
                <IconButton size="small" color="success" aria-label={t("approve")} onClick={() => void handleApprove(row.id, true)}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("reject")}>
                <IconButton size="small" color="error" aria-label={t("reject")} onClick={() => void handleApprove(row.id, false)}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null
        }
      />
      {actingOn && (
        <FormDialog
          open={actionOpen}
          title={actingOn.approved ? t("timesheetApproveTitle") : t("timesheetRejectTitle")}
          fields={[]}
          onSubmit={async () => {
            try {
              await api("/timesheets/" + actingOn.id + "/approve", { method: "PATCH", body: { approved: actingOn.approved } });
              toastSuccess(actingOn.approved ? t("timesheetApproved") : t("timesheetRejected"));
              setActionOpen(false); void refresh();
            } catch (err) {
              toastError(err instanceof Error ? err.message : t("timesheetUpdateFailed"));
            }
          }}
          onClose={() => { setActionOpen(false); setActingOn(null); }}
          submitLabel={actingOn.approved ? t("approve") : t("reject")}
        />
      )}
    </>
  );
}

function LeavesTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<{
    id: string; employeeName: string; type: string; from: string; to: string; days: number; status: string;
  }>("/leaves", { pageSize: 20 });
const [actionOpen, setActionOpen] = useState(false);
  const [actingOn, setActingOn] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
  const t = useTranslations("hr");

  const handleDecision = (id: string, status: "approved" | "rejected") => { setActingOn({ id, status }); setActionOpen(true); };

  return (
    <>
      <DataTable
        columns={[
          { label: t("employee"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.employeeName}</Typography> },
          { label: t("leaveColumnType"), render: (row) => row.type },
          { label: t("leaveColumnFrom"), render: (row) => dateShort(row.from) },
          { label: t("leaveColumnTo"), render: (row) => dateShort(row.to) },
          { label: t("daysColumn"), render: (row) => String(row.days) },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("leaveEmptyTitle")}
        emptySubtitle={t("leaveEmptySubtitle")}
        rowActions={(row) =>
          row.status === "pending" ? (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("approve")}>
                <IconButton size="small" color="success" aria-label={t("approve")} onClick={() => void handleDecision(row.id, "approved")}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("reject")}>
                <IconButton size="small" color="error" aria-label={t("reject")} onClick={() => void handleDecision(row.id, "rejected")}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null
        }
      />
      {actingOn && (
        <FormDialog
          open={actionOpen}
          title={actingOn.status === "approved" ? t("leaveApproveTitle") : t("leaveRejectTitle")}
          fields={[]}
          onSubmit={async () => {
            try {
              await api("/leaves/" + actingOn.id + "/status", { method: "PATCH", body: { status: actingOn.status } });
              toastSuccess(actingOn.status === "approved" ? t("leaveApproved") : t("leaveRejected"));
              setActionOpen(false); setActingOn(null); void refresh();
            } catch (err) {
              toastError(err instanceof Error ? err.message : t("leaveUpdateFailed"));
            }
          }}
          onClose={() => { setActionOpen(false); setActingOn(null); }}
          submitLabel={actingOn.status === "approved" ? t("approve") : t("reject")}
        />
      )}
    </>
  );
}

function ShiftPatternsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ShiftPattern>("/shift-patterns", { pageSize: 20 });
const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftPattern | null>(null);
  const t = useTranslations("hr");

  const handleSubmit = async (values: Record<string, string | number>) => {
    try {
      if (editing) {
        await api("/shift-patterns/" + editing.id, { method: "PATCH", body: values });
        toastSuccess(t("shiftPatternUpdated"));
      } else {
        await api("/shift-patterns", { method: "POST", body: values });
        toastSuccess(t("shiftPatternCreated"));
      }
      setCreateOpen(false); setEditing(null); void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("shiftPatternSaveFailed"));
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("name"), render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: t("shift"), render: (row) => t("shiftRange", { start: row.startTime, end: row.endTime }) },
          { label: t("daysColumn"), render: (row) => row.days.map((d) => t("days." + DAY_KEYS[d])).join(", ") },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("shiftPatternEmptyTitle")}
        emptySubtitle={t("shiftPatternEmptySubtitle")}
        rowActions={(row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("editAria", { name: row.name })}>
              <IconButton size="small" color="primary" aria-label={t("editAria", { name: row.name })} onClick={() => { setEditing(row); setCreateOpen(true); }}>
                <EditOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("newPattern")}</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={editing ? editing.name : t("newShiftPattern")}
        fields={[
          { name: "name", label: t("name"), required: true, defaultValue: editing?.name },
          { name: "startTime", label: t("startTime"), required: true, defaultValue: editing?.startTime },
          { name: "endTime", label: t("endTime"), required: true, defaultValue: editing?.endTime },
        ]}
        onSubmit={handleSubmit}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        submitLabel={editing ? t("save") : t("create")}
      />
    </>
  );
}

function PayrollTab() {
  const { rows: runs, total, page, setPage, loading, refresh } = useList<PayrollRun>("/payroll/runs", { pageSize: 20 });
const [generateOpen, setGenerateOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const t = useTranslations("hr");

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({ value: now.getFullYear() - i, label: String(now.getFullYear() - i) }));

  const handlePay = async (runId: string) => {
    setPayingId(runId);
    try {
      await api("/payroll/runs/" + runId + "/pay", { method: "POST" });
      toastSuccess(t("payrollPaid"));
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("payrollPayFailed"));
    } finally {
      setPayingId(null);
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: t("payrollColumnPeriod"), render: (row) => String(row.period.month).padStart(2, "0") + "/" + row.period.year },
          { label: t("status"), render: (row) => <StatusChip status={row.status} /> },
          { label: t("payrollColumnPaid"), render: (row) => row.paidAt ? dateShort(row.paidAt) : "-" },
          { label: t("payrollColumnEntries"), render: (row) => String(row.entries.length) },
          { label: t("payrollColumnTotalNet"), render: (row) => currency(row.entries.reduce((sum, e) => sum + e.net, 0)) },
        ]}
        rows={runs}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle={t("payrollEmptyTitle")}
        emptySubtitle={t("payrollEmptySubtitle")}
        rowActions={(row) =>
          row.status === "draft" ? (
            <Button
              size="small"
              variant="contained"
              loading={payingId === row.id}
              onClick={() => void handlePay(row.id)}
            >
              {payingId === row.id ? t("paying") : t("pay")}
            </Button>
          ) : null
        }
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)}>{t("generatePayroll")}</Button>
        }
      />
      <FormDialog
        open={generateOpen}
        title={t("generatePayrollRun")}
        fields={[
          { name: "month", label: t("month"), type: "select", required: true, options: monthOptions.map((m) => ({ value: String(m.value), label: m.label })) },
          { name: "year", label: t("year"), type: "select", required: true, defaultValue: yearOptions[0]?.value, options: yearOptions.map((y) => ({ value: String(y.value), label: y.label })) },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/payroll/runs", { method: "POST", body: { month: Number(values.month), year: Number(values.year) } });
            toastSuccess(t("payrollRunGenerated"));
            setGenerateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : t("payrollGenerateFailed"));
          }
        }}
        onClose={() => setGenerateOpen(false)}
        submitLabel={t("generate")}
      />
    </>
  );
}

export default function HrPage() {
  const [tab, setTab] = useState(0);
  const t = useTranslations("hr");
  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
        <Box sx={{ mb: 1 }}>
          <Tabs
            value={tab}
onChange={(_, value) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ minHeight: 48 }}
          >
            <Tab label={t("tabDepartments")} />
            <Tab label={t("tabEmployees")} />
            <Tab label={t("tabAttendance")} />
            <Tab label={t("tabTimesheets")} />
            <Tab label={t("tabLeave")} />
            <Tab label={t("tabShiftPatterns")} />
            <Tab label={t("tabPayroll")} />
          </Tabs>
        </Box>
      </motion.div>
      {tab === 0 && <DepartmentsTab />}
      {tab === 1 && <EmployeesTab />}
      {tab === 2 && <AttendanceTab />}
      {tab === 3 && <TimesheetsTab />}
      {tab === 4 && <LeavesTab />}
      {tab === 5 && <ShiftPatternsTab />}
      {tab === 6 && <PayrollTab />}
    </AppShell>
  );
}
