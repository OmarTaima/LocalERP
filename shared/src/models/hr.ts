import type { ID, Money, CompanyScoped, Timestamps } from "./common";

export type Department = Timestamps &
  CompanyScoped & {
    id: ID;
    name: string;
    parentId: ID | null;
    headUserId: ID | null;
  };

export const EMPLOYEE_STATUSES = ["active", "onLeave", "terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type Employee = Timestamps &
  CompanyScoped & {
    id: ID;
    userId: ID | null;
    name: string;
    email: string;
    departmentId: ID;
    position: string;
    salary: Money;
    hireDate: string;
    status: EmployeeStatus;
  };

export const TIMESHEET_STATUSES = ["draft", "submitted", "approved"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export type Timesheet = Timestamps &
  CompanyScoped & {
    id: ID;
    employeeId: ID;
    date: string;
    hours: number;
    project: string;
    notes: string;
    status: TimesheetStatus;
  };

export type ShiftPattern = Timestamps &
  CompanyScoped & {
    id: ID;
    name: string;
    startTime: string;
    endTime: string;
    days: number[];
  };

export const ATTENDANCE_STATUSES = ["present", "absent", "leave", "holiday", "late"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type Attendance = Timestamps &
  CompanyScoped & {
    id: ID;
    employeeId: ID;
    date: string;
    status: AttendanceStatus;
    shiftPatternId: ID | null;
    note: string;
  };

export const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export type LeaveRequest = Timestamps &
  CompanyScoped & {
    id: ID;
    employeeId: ID;
    type: LeaveType;
    from: string;
    to: string;
    days: number;
    status: LeaveStatus;
    approvedBy: ID | null;
    approvalId: ID | null;
  };

export const PAYROLL_ENTRY_STATUSES = ["pending", "paid"] as const;
export type PayrollEntryStatus = (typeof PAYROLL_ENTRY_STATUSES)[number];

export type PayrollEntry = {
  employeeId: ID;
  gross: Money;
  deductions: Money;
  tax: Money;
  net: Money;
  status: PayrollEntryStatus;
};

export type PayrollRun = Timestamps &
  CompanyScoped & {
    id: ID;
    period: { month: number; year: number };
    entries: PayrollEntry[];
    status: "draft" | "paid";
    paidAt: string | null;
  };