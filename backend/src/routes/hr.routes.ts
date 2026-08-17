import { Router } from "express";
import {
  attendanceBulkSchema,
  departmentSchema,
  departmentUpdateSchema,
  employeeSchema,
  employeeUpdateSchema,
  leaveSchema,
  leaveStatusSchema,
  payrollGenerateSchema,
  shiftPatternSchema,
  shiftPatternUpdateSchema,
  timesheetApproveSchema,
  timesheetSchema,
} from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import {
  approveTimesheet,
  bulkMarkAttendance,
  createDepartment,
  createEmployee,
  createShiftPattern,
  deleteDepartment,
  deleteShiftPattern,
  generatePayrollRun,
  getAttendanceMonth,
  getEmployee,
  listDepartments,
  listEmployees,
  listLeaves,
  listPayrollRuns,
  listShiftPatterns,
  listTimesheets,
  payPayrollRun,
  requestLeave,
  submitTimesheet,
  terminateEmployee,
  updateDepartment,
  updateEmployee,
  updateLeaveStatus,
  updateShiftPattern,
} from "../services/hr.service";

export const hrRouter = Router();

hrRouter.use(auth, tenant);

hrRouter.get("/departments", rbac("hr:read"), asyncHandler(async (req, res) => {
  res.json(await listDepartments(req.tenantId));
}));

hrRouter.post("/departments", rbac("hr:write"), validate(departmentSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createDepartment(req.tenantId, req.userId, req.body));
}));

hrRouter.patch("/departments/:id", rbac("hr:write"), validate(departmentUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateDepartment(req.tenantId, req.userId, req.params.id, req.body));
}));

hrRouter.delete("/departments/:id", rbac("hr:write"), asyncHandler(async (req, res) => {
  res.json(await deleteDepartment(req.tenantId, req.userId, req.params.id));
}));

hrRouter.get("/employees", rbac("hr:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listEmployees(req.tenantId, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

hrRouter.post("/employees", rbac("hr:write"), validate(employeeSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createEmployee(req.tenantId, req.userId, req.body));
}));

hrRouter.get("/employees/:id", rbac("hr:read"), asyncHandler(async (req, res) => {
  res.json(await getEmployee(req.tenantId, req.params.id));
}));

hrRouter.patch("/employees/:id", rbac("hr:write"), validate(employeeUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateEmployee(req.tenantId, req.userId, req.params.id, req.body));
}));

hrRouter.delete("/employees/:id", rbac("hr:write"), asyncHandler(async (req, res) => {
  res.json(await terminateEmployee(req.tenantId, req.userId, req.params.id));
}));

hrRouter.get("/attendance", rbac("hr:read"), asyncHandler(async (req, res) => {
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const year = Number(req.query.year ?? new Date().getFullYear());
  res.json(await getAttendanceMonth(req.tenantId, month, year));
}));

hrRouter.post("/attendance", rbac("hr:write"), validate(attendanceBulkSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await bulkMarkAttendance(req.tenantId, req.userId, req.body));
}));

hrRouter.get("/timesheets", rbac("hr:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listTimesheets(req.tenantId, {
      employeeId: typeof req.query.employeeId === "string" ? req.query.employeeId : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

hrRouter.post("/timesheets", rbac("hr:write"), validate(timesheetSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await submitTimesheet(req.tenantId, req.userId, req.body));
}));

hrRouter.patch("/timesheets/:id/approve", rbac("hr:write"), validate(timesheetApproveSchema), asyncHandler(async (req, res) => {
  res.json(await approveTimesheet(req.tenantId, req.userId, req.params.id, req.body.approved));
}));

hrRouter.get("/leaves", rbac("hr:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listLeaves(req.tenantId, {
      employeeId: typeof req.query.employeeId === "string" ? req.query.employeeId : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

hrRouter.post("/leaves", rbac("hr:write"), validate(leaveSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await requestLeave(req.tenantId, req.userId, req.body));
}));

hrRouter.patch("/leaves/:id/status", rbac("approvals:write"), validate(leaveStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateLeaveStatus(req.tenantId, req.userId, req.params.id, req.body.status));
}));

hrRouter.get("/payroll/runs", rbac("hr:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(await listPayrollRuns(req.tenantId, { page, pageSize }));
}));

hrRouter.post("/payroll/runs", rbac("hr:write"), validate(payrollGenerateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await generatePayrollRun(req.tenantId, req.userId, req.body));
}));

hrRouter.post("/payroll/runs/:id/pay", rbac("hr:write"), asyncHandler(async (req, res) => {
  res.json(await payPayrollRun(req.tenantId, req.userId, req.params.id));
}));

hrRouter.get("/shift-patterns", rbac("hr:read"), asyncHandler(async (req, res) => {
  res.json(await listShiftPatterns(req.tenantId));
}));

hrRouter.post("/shift-patterns", rbac("hr:write"), validate(shiftPatternSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createShiftPattern(req.tenantId, req.userId, req.body));
}));

hrRouter.patch("/shift-patterns/:id", rbac("hr:write"), validate(shiftPatternUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateShiftPattern(req.tenantId, req.userId, req.params.id, req.body));
}));

hrRouter.delete("/shift-patterns/:id", rbac("hr:write"), asyncHandler(async (req, res) => {
  res.json(await deleteShiftPattern(req.tenantId, req.userId, req.params.id));
}));