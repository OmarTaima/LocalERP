import type { AuditAction } from "@erp/shared";
import { AuditLogModel } from "../models";
import { publish } from "../events/bus";

type WriteAuditOptions = {
  companyId: string;
  userId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
};

export async function writeAudit(options: WriteAuditOptions): Promise<void> {
  await AuditLogModel.create({
    companyId: options.companyId,
    userId: options.userId,
    action: options.action,
    entity: options.entity,
    entityId: options.entityId,
    changes: {
      before: options.before ?? null,
      after: options.after ?? null,
    },
    ip: options.ip ?? "",
  });
  publish({ type: "audit.recorded", payload: { entity: options.entity, action: options.action } });
}

export function diff<T extends object>(before: T, after: T): { before: Partial<T>; after: Partial<T> } {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}