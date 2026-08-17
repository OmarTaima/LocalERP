"use client"

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { AppShell, itemVariants } from "@/components/app-shell";
import { PageHeader, StatusChip, toastSuccess, toastError } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { useList, currency, dateShort } from "@/lib/use-list";
import { api } from "@/lib/api";

type Department = { id: string; name: string; parentId: string | null; headUserId: string | null; childCount: number };
type Employee = { id: string; userId: string | null; name: string; email: string; departmentId: string; departmentName: string; position: string; salary: number; hireDate: string; status: string };
type ShiftPattern = { id: string; name: string; startTime: string; endTime: string; days: number[] };
type PayrollEntry = { employeeId: string; gross: number; deductions: number; tax: number; net: number; status: string };
type PayrollRun = { id: string; period: { month: number; year: number }; entries: PayrollEntry[]; status: string; paidAt: string | null };
type AttendanceRow = { id: string; employeeId: string; date: string; status: string; shiftPatternId: string | null };

const EMPLOYEE_STATUSES = ["active", "onLeave", "terminated"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DepartmentsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<Department>("/departments");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Parent", render: (row) => row.parentId ? "#" + row.parentId.slice(-6) : "-" },
          { label: "Children", render: (row) => String(row.childCount) },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No departments"
        emptySubtitle="Departments group employees and drive reporting"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New department</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title="New department"
        fields={[{ name: "name", label: "Name", required: true }]}
        onSubmit={async (values) => {
          try {
            await api("/departments", { method: "POST", body: { name: values.name } });
            toastSuccess("Department created");
            setCreateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "Failed to create department");
          }
        }}
        onClose={() => setCreateOpen(false)}
        submitLabel="Create"
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
        toastSuccess("Employee updated");
      } else {
        await api("/employees", { method: "POST", body });
        toastSuccess("Employee created");
      }
      setCreateOpen(false); setEditing(null);
      fetchData(page);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save employee");
    }
  };

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 240 }}
        />
        <TextField
          size="small"
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ width: 160 }}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {EMPLOYEE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Department", render: (row) => deptName(row.departmentId) },
          { label: "Position", render: (row) => row.position },
          { label: "Salary", render: (row) => currency(row.salary) },
          { label: "Hire date", render: (row) => dateShort(row.hireDate) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={employees}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No employees"
        emptySubtitle="Employees appear once created"
        rowActions={(row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="outlined" onClick={() => { setEditing(row); setCreateOpen(true); }}>
              <EditIcon fontSize="small" />
            </Button>
          </Stack>
        )}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New employee</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={editing ? editing.name : "New employee"}
        fields={[
          { name: "name", label: "Full name", required: true, defaultValue: editing?.name },
          { name: "email", label: "Email", required: true, defaultValue: editing?.email },
          { name: "departmentId", label: "Department", type: "select", required: true, options: deptOptions, defaultValue: editing?.departmentId },
          { name: "position", label: "Position", required: true, defaultValue: editing?.position },
          { name: "salary", label: "Salary", type: "number", required: true, defaultValue: editing?.salary },
          { name: "hireDate", label: "Hire date", type: "date", required: true, defaultValue: editing?.hireDate },
        ]}
        onSubmit={handleSubmit}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        submitLabel={editing ? "Save" : "Create"}
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

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? "#id:" + id.slice(-6);

  const fetchMonth = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ month: String(month), year: String(year) });
      const data = await api<AttendanceRow[]>("/attendance?" + q.toString());
      setAttendance(data.map((r, i) => ({ ...r, id: r.id ?? "att-" + i })));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to load attendance");
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
        <TextField size="small" type="number" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ width: 110 }} inputProps={{ min: 1, max: 12 }} />
        <TextField size="small" type="number" label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ width: 110 }} inputProps={{ min: 2000 }} />
        <Typography sx={{ color: "#64748b", fontSize: 13 }}>{present} present, {absent} absent, {late} late, {onLeave} on leave</Typography>
      </Stack>
      <DataTable
        columns={[
          { label: "Employee", render: (row) => <Typography sx={{ fontWeight: 600 }}>{empName(row.employeeId)}</Typography> },
          { label: "Date", render: (row) => dateShort(row.date) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
          { label: "Shift", render: (row) => row.shiftPatternId ? "shift:" + row.shiftPatternId.slice(-6) : "-" },
        ]}
        rows={attendance}
        total={attendance.length}
        page={1}
        onPageChange={() => undefined}
        loading={loading}
        emptyTitle="No attendance"
        emptySubtitle="Attendance for this month will appear here"
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

  const handleApprove = (id: string, approved: boolean) => { setActingOn({ id, approved }); setActionOpen(true); };

  return (
    <>
      <DataTable
        columns={[
          { label: "Date", render: (row) => dateShort(row.date) },
          { label: "Employee", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.employeeName}</Typography> },
          { label: "Project", render: (row) => row.project },
          { label: "Hours", render: (row) => String(row.hours) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No timesheets"
        emptySubtitle="Timesheets appear once submitted"
        rowActions={(row) =>
          row.status === "submitted" ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="contained" onClick={() => void handleApprove(row.id, true)}>Approve</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => void handleApprove(row.id, false)}>Reject</Button>
            </Stack>
          ) : null
        }
      />
      {actingOn && (
        <FormDialog
          open={actionOpen}
          title={actingOn.approved ? "Approve timesheet?" : "Reject timesheet?"}
          fields={[]}
          onSubmit={async () => {
            try {
              await api("/timesheets/" + actingOn.id + "/approve", { method: "PATCH", body: { approved: actingOn.approved } });
              toastSuccess("Timesheet " + (actingOn.approved ? "approved" : "rejected"));
              setActionOpen(false); void refresh();
            } catch (err) {
              toastError(err instanceof Error ? err.message : "Failed to update timesheet");
            }
          }}
          onClose={() => { setActionOpen(false); setActingOn(null); }}
          submitLabel={actingOn.approved ? "Approve" : "Reject"}
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

  const handleDecision = (id: string, status: "approved" | "rejected") => { setActingOn({ id, status }); setActionOpen(true); };

  return (
    <>
      <DataTable
        columns={[
          { label: "Employee", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.employeeName}</Typography> },
          { label: "Type", render: (row) => row.type },
          { label: "From", render: (row) => dateShort(row.from) },
          { label: "To", render: (row) => dateShort(row.to) },
          { label: "Days", render: (row) => String(row.days) },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No leave requests"
        emptySubtitle="Pending, approved and rejected requests appear here"
        rowActions={(row) =>
          row.status === "pending" ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="contained" onClick={() => void handleDecision(row.id, "approved")}>Approve</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => void handleDecision(row.id, "rejected")}>Reject</Button>
            </Stack>
          ) : null
        }
      />
      {actingOn && (
        <FormDialog
          open={actionOpen}
          title={actingOn.status === "approved" ? "Approve leave?" : "Reject leave?"}
          fields={[]}
          onSubmit={async () => {
            try {
              await api("/leaves/" + actingOn.id + "/status", { method: "PATCH", body: { status: actingOn.status } });
              toastSuccess("Leave " + actingOn.status);
              setActionOpen(false); setActingOn(null); void refresh();
            } catch (err) {
              toastError(err instanceof Error ? err.message : "Failed to update leave");
            }
          }}
          onClose={() => { setActionOpen(false); setActingOn(null); }}
          submitLabel={actingOn.status === "approved" ? "Approve" : "Reject"}
        />
      )}
    </>
  );
}

function ShiftPatternsTab() {
  const { rows, total, page, setPage, loading, refresh } = useList<ShiftPattern>("/shift-patterns", { pageSize: 20 });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftPattern | null>(null);

  const handleSubmit = async (values: Record<string, string | number>) => {
    try {
      if (editing) {
        await api("/shift-patterns/" + editing.id, { method: "PATCH", body: values });
        toastSuccess("Shift pattern updated");
      } else {
        await api("/shift-patterns", { method: "POST", body: values });
        toastSuccess("Shift pattern created");
      }
      setCreateOpen(false); setEditing(null); void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to save shift pattern");
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Name", render: (row) => <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography> },
          { label: "Shift", render: (row) => row.startTime + " to " + row.endTime },
          { label: "Days", render: (row) => row.days.map((d) => DAY_NAMES[d]).join(", ") },
        ]}
        rows={rows}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No shift patterns"
        emptySubtitle="Define shift patterns for attendance tracking"
        rowActions={(row) => (
          <Button size="small" variant="outlined" onClick={() => { setEditing(row); setCreateOpen(true); }}>
            <EditIcon fontSize="small" />
          </Button>
        )}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New pattern</Button>
        }
      />
      <FormDialog
        open={createOpen}
        title={editing ? editing.name : "New shift pattern"}
        fields={[
          { name: "name", label: "Name", required: true, defaultValue: editing?.name },
          { name: "startTime", label: "Start time", required: true, defaultValue: editing?.startTime },
          { name: "endTime", label: "End time", required: true, defaultValue: editing?.endTime },
        ]}
        onSubmit={handleSubmit}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        submitLabel={editing ? "Save" : "Create"}
      />
    </>
  );
}

function PayrollTab() {
  const { rows: runs, total, page, setPage, loading, refresh } = useList<PayrollRun>("/payroll/runs", { pageSize: 20 });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const yearOptions = Array.from({ length: 5 }, (_, i) => ({ value: now.getFullYear() - i, label: String(now.getFullYear() - i) }));

  const handlePay = async (runId: string) => {
    setPayingId(runId);
    try {
      await api("/payroll/runs/" + runId + "/pay", { method: "POST" });
      toastSuccess("Payroll paid");
      void refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to pay payroll");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <>
      <DataTable
        columns={[
          { label: "Period", render: (row) => String(row.period.month).padStart(2, "0") + "/" + row.period.year },
          { label: "Status", render: (row) => <StatusChip status={row.status} /> },
          { label: "Paid", render: (row) => row.paidAt ? dateShort(row.paidAt) : "-" },
          { label: "Entries", render: (row) => String(row.entries.length) },
          { label: "Total net", render: (row) => currency(row.entries.reduce((sum, e) => sum + e.net, 0)) },
        ]}
        rows={runs}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        emptyTitle="No payroll runs"
        emptySubtitle="Generate payroll for the month to create runs here"
        rowActions={(row) =>
          row.status === "draft" ? (
            <Button
              size="small"
              variant="contained"
              loading={payingId === row.id}
              onClick={() => void handlePay(row.id)}
            >
              {payingId === row.id ? "Paying..." : "Pay"}
            </Button>
          ) : null
        }
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)}>Generate payroll</Button>
        }
      />
      <FormDialog
        open={generateOpen}
        title="Generate payroll run"
        fields={[
          { name: "month", label: "Month", type: "select", required: true, options: monthOptions.map((m) => ({ value: String(m.value), label: m.label })) },
          { name: "year", label: "Year", type: "select", required: true, defaultValue: yearOptions[0]?.value, options: yearOptions.map((y) => ({ value: String(y.value), label: y.label })) },
        ]}
        onSubmit={async (values) => {
          try {
            await api("/payroll/runs", { method: "POST", body: { month: Number(values.month), year: Number(values.year) } });
            toastSuccess("Payroll run generated");
            setGenerateOpen(false);
            void refresh();
          } catch (err) {
            toastError(err instanceof Error ? err.message : "Failed to generate payroll");
          }
        }}
        onClose={() => setGenerateOpen(false)}
        submitLabel="Generate"
      />
    </>
  );
}

export default function HrPage() {
  const [tab, setTab] = useState(0);
  return (
    <AppShell>
      <motion.div variants={itemVariants}>
        <PageHeader title="Human Resources" subtitle="Departments, employees, attendance and payroll" />
        <Box sx={{ mb: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            sx={{ minHeight: 48 }}
          >
            <Tab label="Departments" />
            <Tab label="Employees" />
            <Tab label="Attendance" />
            <Tab label="Timesheets" />
            <Tab label="Leave" />
            <Tab label="Shift patterns" />
            <Tab label="Payroll" />
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
