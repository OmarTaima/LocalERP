import mongoose from "mongoose";
import type { AttendanceStatus, LeaveStatus, LeaveType, TimesheetStatus } from "@erp/shared";
import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { nextNumber } from "../models/counter";
import {
  AccountModel,
  AttendanceModel,
  DepartmentModel,
  EmployeeModel,
  JournalEntryModel,
  LeaveRequestModel,
  PayrollRunModel,
  ShiftPatternModel,
  TimesheetModel,
  UserModel,
  type DepartmentDoc,
  type EmployeeDoc,
  type LeaveRequestDoc,
  type PayrollRunDoc,
  type ShiftPatternDoc,
  type TimesheetDoc,
} from "../models";

function serializeDepartment(doc: DepartmentDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    headUserId: doc.headUserId ? doc.headUserId.toString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listDepartments(tenantId: string) {
  const docs = await DepartmentModel.find({ tenantId }).sort({ name: 1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    headUserId: doc.headUserId ? doc.headUserId.toString() : null,
    childCount: docs.filter((other) => other.parentId && other.parentId.equals(doc._id)).length,
  }));
}

export async function createDepartment(tenantId: string, userId: string, input: { name: string; parentId?: string | null; headUserId?: string | null }) {
  if (input.parentId) {
    const parent = await DepartmentModel.exists({ _id: input.parentId, tenantId });
    if (!parent) throw new AppError(404, "parent department not found");
  }
  if (input.headUserId) {
    const head = await UserModel.exists({ _id: input.headUserId, tenantId });
    if (!head) throw new AppError(404, "head user not found");
  }
  const doc = await DepartmentModel.create({
    tenantId,
    name: input.name,
    parentId: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
    headUserId: input.headUserId ? new mongoose.Types.ObjectId(input.headUserId) : null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Department", entityId: doc._id.toString(), after: { name: doc.name } });
  return serializeDepartment(doc);
}

export async function updateDepartment(tenantId: string, userId: string, departmentId: string, input: { name?: string; parentId?: string | null; headUserId?: string | null }) {
  const doc = await DepartmentModel.findOne({ _id: departmentId, tenantId });
  if (!doc) throw new AppError(404, "department not found");
  if (input.parentId) {
    if (input.parentId === departmentId) throw new AppError(400, "department cannot be its own parent");
    const parent = await DepartmentModel.exists({ _id: input.parentId, tenantId });
    if (!parent) throw new AppError(404, "parent department not found");
  }
  const before = { name: doc.name, parentId: doc.parentId?.toString() ?? null, headUserId: doc.headUserId?.toString() ?? null };
  if (input.name !== undefined) doc.name = input.name;
  if (input.parentId !== undefined) doc.parentId = input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null;
  if (input.headUserId !== undefined) doc.headUserId = input.headUserId ? new mongoose.Types.ObjectId(input.headUserId) : null;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Department", entityId: departmentId, before, after: serializeDepartment(doc) });
  return serializeDepartment(doc);
}

export async function deleteDepartment(tenantId: string, userId: string, departmentId: string) {
  const doc = await DepartmentModel.findOne({ _id: departmentId, tenantId });
  if (!doc) throw new AppError(404, "department not found");
  const child = await DepartmentModel.exists({ tenantId, parentId: doc._id });
  if (child) throw new AppError(400, "department has child departments");
  const member = await EmployeeModel.exists({ tenantId, departmentId: doc._id, status: { $ne: "terminated" } });
  if (member) throw new AppError(400, "department still has employees");
  await doc.deleteOne();
  await writeAudit({ tenantId, userId, action: "delete", entity: "Department", entityId: departmentId, before: { name: doc.name } });
  return { id: departmentId, deleted: true };
}

function serializeEmployee(doc: EmployeeDoc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    name: doc.name,
    email: doc.email,
    departmentId: doc.departmentId.toString(),
    position: doc.position,
    salary: doc.salary,
    hireDate: doc.hireDate.toISOString().slice(0, 10),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listEmployees(tenantId: string, query: { search?: string; departmentId?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: "i" } }, { email: { $regex: query.search, $options: "i" } }, { position: { $regex: query.search, $options: "i" } }];
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    EmployeeModel.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    EmployeeModel.countDocuments(filter),
  ]);
  const departments = await DepartmentModel.find({ tenantId, _id: { $in: docs.map((doc) => doc.departmentId) } }).lean();
  const departmentMap = new Map(departments.map((department) => [department._id.toString(), department.name]));
  return {
    items: docs.map((doc) => ({ ...serializeEmployee(doc), departmentName: departmentMap.get(doc.departmentId.toString()) ?? "" })),
    total,
    page,
    pageSize,
  };
}

export async function getEmployee(tenantId: string, employeeId: string) {
  const doc = await EmployeeModel.findOne({ _id: employeeId, tenantId }).lean();
  if (!doc) throw new AppError(404, "employee not found");
  return serializeEmployee(doc);
}

export async function createEmployee(tenantId: string, userId: string, input: { userId?: string | null; name: string; email: string; departmentId: string; position: string; salary: number; hireDate: string; status?: string }) {
  const department = await DepartmentModel.exists({ _id: input.departmentId, tenantId });
  if (!department) throw new AppError(404, "department not found");
  if (input.userId) {
    const user = await UserModel.exists({ _id: input.userId, tenantId });
    if (!user) throw new AppError(404, "user not found");
  }
  const doc = await EmployeeModel.create({
    tenantId,
    userId: input.userId ? new mongoose.Types.ObjectId(input.userId) : null,
    name: input.name,
    email: input.email,
    departmentId: new mongoose.Types.ObjectId(input.departmentId),
    position: input.position,
    salary: input.salary,
    hireDate: new Date(input.hireDate),
    status: (input.status ?? "active") as EmployeeDoc["status"],
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Employee", entityId: doc._id.toString(), after: { name: doc.name, email: doc.email } });
  publish({ type: "hr.employee.created", payload: { tenantId, employeeId: doc._id.toString(), name: doc.name } });
  return serializeEmployee(doc);
}

export async function updateEmployee(tenantId: string, userId: string, employeeId: string, input: Partial<{ userId: string | null; name: string; email: string; departmentId: string; position: string; salary: number; hireDate: string; status: string }>) {
  const doc = await EmployeeModel.findOne({ _id: employeeId, tenantId });
  if (!doc) throw new AppError(404, "employee not found");
  if (input.departmentId) {
    const department = await DepartmentModel.exists({ _id: input.departmentId, tenantId });
    if (!department) throw new AppError(404, "department not found");
  }
  if (input.userId !== undefined && input.userId !== null) {
    const user = await UserModel.exists({ _id: input.userId, tenantId });
    if (!user) throw new AppError(404, "user not found");
  }
  const before = { name: doc.name, email: doc.email, position: doc.position, salary: doc.salary, status: doc.status };
  if (input.name !== undefined) doc.name = input.name;
  if (input.email !== undefined) doc.email = input.email;
  if (input.departmentId !== undefined) doc.departmentId = new mongoose.Types.ObjectId(input.departmentId);
  if (input.position !== undefined) doc.position = input.position;
  if (input.salary !== undefined) doc.salary = input.salary;
  if (input.hireDate !== undefined) doc.hireDate = new Date(input.hireDate);
  if (input.status !== undefined) doc.status = input.status as EmployeeDoc["status"];
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Employee", entityId: employeeId, before, after: serializeEmployee(doc) });
  return serializeEmployee(doc);
}

export async function terminateEmployee(tenantId: string, userId: string, employeeId: string) {
  const doc = await EmployeeModel.findOne({ _id: employeeId, tenantId });
  if (!doc) throw new AppError(404, "employee not found");
  if (doc.status === "terminated") throw new AppError(400, "employee already terminated");
  doc.status = "terminated";
  await doc.save();
  await writeAudit({ tenantId, userId, action: "terminate", entity: "Employee", entityId: employeeId, before: { status: "active" }, after: { status: "terminated" } });
  publish({ type: "hr.employee.terminated", payload: { tenantId, employeeId, name: doc.name } });
  return serializeEmployee(doc);
}

export async function getAttendanceMonth(tenantId: string, month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const docs = await AttendanceModel.find({ tenantId, date: { $gte: from, $lt: to } }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    date: doc.date.toISOString().slice(0, 10),
    status: doc.status,
    shiftPatternId: doc.shiftPatternId ? doc.shiftPatternId.toString() : null,
    note: doc.note,
  }));
}

export async function bulkMarkAttendance(tenantId: string, userId: string, input: { date: string; entries: Array<{ employeeId: string; status: AttendanceStatus; shiftPatternId?: string | null; note?: string }> }) {
  const date = new Date(input.date);
  const results = [];
  for (const entry of input.entries) {
    const employee = await EmployeeModel.exists({ _id: entry.employeeId, tenantId });
    if (!employee) throw new AppError(404, `employee ${entry.employeeId} not found`);
    const existing = await AttendanceModel.findOne({ tenantId, employeeId: entry.employeeId, date });
    if (existing) {
      existing.status = entry.status;
      existing.shiftPatternId = entry.shiftPatternId ? new mongoose.Types.ObjectId(entry.shiftPatternId) : null;
      existing.note = entry.note ?? "";
      await existing.save();
      results.push({ id: existing._id.toString(), employeeId: entry.employeeId, status: entry.status });
    } else {
      const doc = await AttendanceModel.create({
        tenantId,
        employeeId: new mongoose.Types.ObjectId(entry.employeeId),
        date,
        status: entry.status,
        shiftPatternId: entry.shiftPatternId ? new mongoose.Types.ObjectId(entry.shiftPatternId) : null,
        note: entry.note ?? "",
      });
      results.push({ id: doc._id.toString(), employeeId: entry.employeeId, status: entry.status });
    }
  }
  await writeAudit({ tenantId, userId, action: "create", entity: "Attendance", entityId: results[0].id, after: { date: input.date, count: results.length } });
  publish({ type: "attendance.recorded", payload: { tenantId, date: input.date, count: results.length } });
  return { count: results.length, entries: results };
}

function serializeTimesheet(doc: TimesheetDoc) {
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    date: doc.date.toISOString().slice(0, 10),
    hours: doc.hours,
    project: doc.project,
    notes: doc.notes,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listTimesheets(tenantId: string, query: { employeeId?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    TimesheetModel.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    TimesheetModel.countDocuments(filter),
  ]);
  return { items: docs.map((doc) => ({ ...serializeTimesheet(doc), status: doc.status as TimesheetStatus })), total, page, pageSize };
}

export async function submitTimesheet(tenantId: string, userId: string, input: { employeeId: string; date: string; hours: number; project: string; notes?: string; status?: string }) {
  const employee = await EmployeeModel.exists({ _id: input.employeeId, tenantId });
  if (!employee) throw new AppError(404, "employee not found");
  const doc = await TimesheetModel.create({
    tenantId,
    employeeId: new mongoose.Types.ObjectId(input.employeeId),
    date: new Date(input.date),
    hours: input.hours,
    project: input.project,
    notes: input.notes ?? "",
    status: (input.status ?? "submitted") as TimesheetDoc["status"],
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Timesheet", entityId: doc._id.toString(), after: { employeeId: input.employeeId, date: input.date, hours: input.hours } });
  return serializeTimesheet(doc);
}

export async function approveTimesheet(tenantId: string, userId: string, timesheetId: string, approved: boolean) {
  const doc = await TimesheetModel.findOne({ _id: timesheetId, tenantId });
  if (!doc) throw new AppError(404, "timesheet not found");
  if (doc.status !== "submitted") throw new AppError(400, `timesheet cannot be ${approved ? "approved" : "rejected"} in ${doc.status} state`);
  const before = { status: doc.status };
  doc.status = approved ? "approved" : "draft";
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Timesheet", entityId: timesheetId, before, after: { status: doc.status } });
  return serializeTimesheet(doc);
}

function serializeLeave(doc: LeaveRequestDoc) {
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    type: doc.type as LeaveType,
    from: doc.from.toISOString().slice(0, 10),
    to: doc.to.toISOString().slice(0, 10),
    days: doc.days,
    status: doc.status as LeaveStatus,
    approvedBy: doc.approvedBy ? doc.approvedBy.toString() : null,
    approvalId: doc.approvalId ? doc.approvalId.toString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listLeaves(tenantId: string, query: { employeeId?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    LeaveRequestModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    LeaveRequestModel.countDocuments(filter),
  ]);
  const employees = await EmployeeModel.find({ tenantId, _id: { $in: docs.map((doc) => doc.employeeId) } }).lean();
  const employeeMap = new Map(employees.map((employee) => [employee._id.toString(), employee.name]));
  return {
    items: docs.map((doc) => ({ ...serializeLeave(doc), employeeName: employeeMap.get(doc.employeeId.toString()) ?? "" })),
    total,
    page,
    pageSize,
  };
}

export async function requestLeave(tenantId: string, userId: string, input: { employeeId: string; type: LeaveType; from: string; to: string; days?: number; status?: string }) {
  const employee = await EmployeeModel.exists({ _id: input.employeeId, tenantId });
  if (!employee) throw new AppError(404, "employee not found");
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (to < from) throw new AppError(400, "leave end must be after start");
  const days = input.days ?? Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const doc = await LeaveRequestModel.create({
    tenantId,
    employeeId: new mongoose.Types.ObjectId(input.employeeId),
    type: input.type,
    from,
    to,
    days,
    status: (input.status ?? "pending") as LeaveRequestDoc["status"],
    approvedBy: null,
    approvalId: null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "LeaveRequest", entityId: doc._id.toString(), after: { employeeId: input.employeeId, type: input.type, from: input.from, to: input.to, days } });
  publish({ type: "leave.requested", payload: { tenantId, leaveId: doc._id.toString(), employeeId: input.employeeId, type: input.type } });
  return serializeLeave(doc);
}

export async function updateLeaveStatus(tenantId: string, userId: string, leaveId: string, status: "approved" | "rejected") {
  const doc = await LeaveRequestModel.findOne({ _id: leaveId, tenantId });
  if (!doc) throw new AppError(404, "leave request not found");
  if (doc.status !== "pending") throw new AppError(400, `leave already ${doc.status}`);
  const before = { status: doc.status };
  doc.status = status;
  doc.approvedBy = new mongoose.Types.ObjectId(userId);
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "LeaveRequest", entityId: leaveId, before, after: { status, approvedBy: userId } });
  publish({ type: "leave.approved", payload: { tenantId, leaveId, employeeId: doc.employeeId.toString(), status } });
  return serializeLeave(doc);
}

function serializeShiftPattern(doc: ShiftPatternDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    startTime: doc.startTime,
    endTime: doc.endTime,
    days: doc.days,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listShiftPatterns(tenantId: string) {
  const docs = await ShiftPatternModel.find({ tenantId }).sort({ name: 1 }).lean();
  return docs.map(serializeShiftPattern);
}

export async function createShiftPattern(tenantId: string, userId: string, input: { name: string; startTime: string; endTime: string; days: number[] }) {
  const doc = await ShiftPatternModel.create({ tenantId, name: input.name, startTime: input.startTime, endTime: input.endTime, days: input.days });
  await writeAudit({ tenantId, userId, action: "create", entity: "ShiftPattern", entityId: doc._id.toString(), after: { name: doc.name } });
  return serializeShiftPattern(doc);
}

export async function updateShiftPattern(tenantId: string, userId: string, shiftPatternId: string, input: Partial<{ name: string; startTime: string; endTime: string; days: number[] }>) {
  const doc = await ShiftPatternModel.findOne({ _id: shiftPatternId, tenantId });
  if (!doc) throw new AppError(404, "shift pattern not found");
  const before = { name: doc.name, startTime: doc.startTime, endTime: doc.endTime, days: doc.days };
  if (input.name !== undefined) doc.name = input.name;
  if (input.startTime !== undefined) doc.startTime = input.startTime;
  if (input.endTime !== undefined) doc.endTime = input.endTime;
  if (input.days !== undefined) doc.days = input.days;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "ShiftPattern", entityId: shiftPatternId, before, after: serializeShiftPattern(doc) });
  return serializeShiftPattern(doc);
}

export async function deleteShiftPattern(tenantId: string, userId: string, shiftPatternId: string) {
  const doc = await ShiftPatternModel.findOne({ _id: shiftPatternId, tenantId });
  if (!doc) throw new AppError(404, "shift pattern not found");
  await doc.deleteOne();
  await writeAudit({ tenantId, userId, action: "delete", entity: "ShiftPattern", entityId: shiftPatternId, before: { name: doc.name } });
  return { id: shiftPatternId, deleted: true };
}

function serializePayrollRun(doc: PayrollRunDoc) {
  return {
    id: doc._id.toString(),
    period: doc.period,
    entries: doc.entries.map((entry) => ({
      employeeId: entry.employeeId.toString(),
      gross: entry.gross,
      deductions: entry.deductions,
      tax: entry.tax,
      net: entry.net,
      status: entry.status,
    })),
    status: doc.status,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function listPayrollRuns(tenantId: string, query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const [docs, total] = await Promise.all([
    PayrollRunModel.find({ tenantId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    PayrollRunModel.countDocuments({ tenantId }),
  ]);
  return { items: docs.map(serializePayrollRun), total, page, pageSize };
}

export async function generatePayrollRun(tenantId: string, userId: string, input: { month: number; year: number }) {
  const existing = await PayrollRunModel.exists({ tenantId, "period.month": input.month, "period.year": input.year });
  if (existing) throw new AppError(409, `payroll for ${input.year}-${String(input.month).padStart(2, "0")} already generated`);
  const employees = await EmployeeModel.find({ tenantId, status: "active" }).lean();
  if (employees.length === 0) throw new AppError(400, "no active employees to run payroll");
  const entries = employees.map((employee) => {
    const gross = round2(employee.salary / 12);
    const tax = round2(gross * 0.2);
    const deductions = 0;
    return { employeeId: employee._id, gross, deductions, tax, net: round2(gross - tax), status: "pending" as const };
  });
  const doc = await PayrollRunModel.create({
    tenantId,
    period: { month: input.month, year: input.year },
    entries,
    status: "draft",
    paidAt: null,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "PayrollRun", entityId: doc._id.toString(), after: { period: doc.period, entryCount: entries.length } });
  return serializePayrollRun(doc);
}

export async function payPayrollRun(tenantId: string, userId: string, runId: string) {
  const doc = await PayrollRunModel.findOne({ _id: runId, tenantId });
  if (!doc) throw new AppError(404, "payroll run not found");
  if (doc.status === "paid") throw new AppError(400, "payroll run already paid");
  const totalNet = round2(doc.entries.reduce((sum, entry) => sum + entry.net, 0));
  const salaryAccount = await AccountModel.findOne({ tenantId, code: "5100" });
  const payableAccount = await AccountModel.findOne({ tenantId, code: "2000" });
  if (salaryAccount && payableAccount) {
    const entry = await JournalEntryModel.create({
      tenantId,
      entryNumber: await nextNumber(tenantId, "journal", "JE"),
      date: new Date(),
      description: `Payroll ${doc.period.year}-${String(doc.period.month).padStart(2, "0")} (${doc.entries.length} employees)`,
      reference: { type: "payroll", id: runId },
      lines: [
        { accountId: salaryAccount._id, debit: totalNet, credit: 0, currency: "USD", fxRate: 1, description: "salary expense" },
        { accountId: payableAccount._id, debit: 0, credit: totalNet, currency: "USD", fxRate: 1, description: "salaries payable" },
      ],
      status: "posted",
      reversedById: null,
      createdBy: userId,
    });
    publish({ type: "payroll.paid", payload: { tenantId, runId, period: doc.period, journalEntryId: entry._id.toString(), totalNet } });
  }
  doc.status = "paid";
  doc.paidAt = new Date();
  doc.entries.forEach((entry) => {
    entry.status = "paid";
  });
  await doc.save();
  await writeAudit({ tenantId, userId, action: "pay", entity: "PayrollRun", entityId: runId, before: { status: "draft" }, after: { status: "paid", totalNet } });
  return serializePayrollRun(doc);
}