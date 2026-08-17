import type { ID, CompanyScoped, Timestamps } from "./common";

export const AUDIT_ACTIONS = ["create", "update", "delete", "approve", "reject", "login", "export", "terminate", "pay"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLog = Timestamps &
  CompanyScoped & {
    id: ID;
    userId: ID;
    action: AuditAction;
    entity: string;
    entityId: ID;
    changes: {
      before?: object;
      after?: object;
    };
    ip: string;
  };

export const NOTIFICATION_TYPES = [
  "stock-alert",
  "order",
  "approval",
  "invoice",
  "leave",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = Timestamps &
  CompanyScoped & {
    id: ID;
    userId: ID;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
    isRead: boolean;
  };

export type NotificationPreference = Timestamps &
  CompanyScoped & {
    id: ID;
    userId: ID;
    channels: {
      inApp: boolean;
      email: boolean;
    };
  };

export const JOB_STATUSES = ["queued", "processing", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const IMPORT_TYPES = ["products", "customers", "orders", "employees"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export type ImportJob = Timestamps &
  CompanyScoped & {
    id: ID;
    type: ImportType;
    fileUrl: string;
    status: JobStatus;
    result: {
      processed: number;
      failed: number;
      errors: string[];
    };
    createdBy: ID;
  };

export type ExportJob = Timestamps &
  CompanyScoped & {
    id: ID;
    type: ImportType;
    status: JobStatus;
    fileUrl: string | null;
    createdBy: ID;
  };

export type Setting = Timestamps &
  CompanyScoped & {
    id: ID;
    key: string;
    value: unknown;
  };

export type FeatureFlag = Timestamps & {
  id: ID;
  key: string;
  enabledForCompanyIds: ID[];
  defaultEnabled: boolean;
};

export type PlanLimit = {
  plan: "starter" | "pro" | "enterprise";
  maxUsers: number;
  maxProducts: number;
  features: string[];
};