import Joi from "joi";
import { ATTENDANCE_STATUSES, EMPLOYEE_STATUSES, LEAVE_STATUSES, LEAVE_TYPES } from "../models/hr";

export const departmentSchema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  parentId: Joi.string().optional().allow(null),
  headUserId: Joi.string().optional().allow(null),
});

export const departmentUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  parentId: Joi.string().optional().allow(null),
  headUserId: Joi.string().optional().allow(null),
});

export const employeeSchema = Joi.object({
  userId: Joi.string().optional().allow(null),
  name: Joi.string().min(1).max(160).required(),
  email: Joi.string().email().required(),
  departmentId: Joi.string().min(1).required(),
  position: Joi.string().min(1).max(120).required(),
  salary: Joi.number().min(0).required(),
  hireDate: Joi.string().isoDate().required(),
  status: Joi.string().valid(...EMPLOYEE_STATUSES).optional(),
});

export const employeeUpdateSchema = Joi.object({
  userId: Joi.string().optional().allow(null),
  name: Joi.string().min(1).max(160).optional(),
  email: Joi.string().email().optional(),
  departmentId: Joi.string().min(1).optional(),
  position: Joi.string().min(1).max(120).optional(),
  salary: Joi.number().min(0).optional(),
  hireDate: Joi.string().isoDate().optional(),
  status: Joi.string().valid(...EMPLOYEE_STATUSES).optional(),
});

export const attendanceBulkSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  entries: Joi.array()
    .items(
      Joi.object({
        employeeId: Joi.string().min(1).required(),
        status: Joi.string().valid(...ATTENDANCE_STATUSES).required(),
        shiftPatternId: Joi.string().optional().allow(null),
        note: Joi.string().max(200).optional().default("").allow(""),
      }),
    )
    .min(1)
    .required(),
});

export const timesheetSchema = Joi.object({
  employeeId: Joi.string().min(1).required(),
  date: Joi.string().isoDate().required(),
  hours: Joi.number().min(0).max(24).required(),
  project: Joi.string().min(1).max(120).required(),
  notes: Joi.string().max(300).optional().default("").allow(""),
  status: Joi.string().valid("draft", "submitted", "approved").optional(),
});

export const timesheetUpdateSchema = timesheetSchema.fork(["employeeId", "date", "hours", "project", "notes", "status"], (schema) => schema.optional());

export const timesheetApproveSchema = Joi.object({
  approved: Joi.boolean().required(),
});

export const leaveSchema = Joi.object({
  employeeId: Joi.string().min(1).required(),
  type: Joi.string().valid(...LEAVE_TYPES).required(),
  from: Joi.string().isoDate().required(),
  to: Joi.string().isoDate().required(),
  days: Joi.number().integer().min(1).optional(),
  status: Joi.string().valid(...LEAVE_STATUSES).optional(),
});

export const leaveStatusSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});

export const shiftPatternSchema = Joi.object({
  name: Joi.string().min(1).max(80).required(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  days: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required(),
});

export const shiftPatternUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(80).optional(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  days: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(),
});

export const payrollGenerateSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
});