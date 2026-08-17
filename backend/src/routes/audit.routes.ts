import { Router } from "express";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { asyncHandler } from "../utils/async-handler";
import { parseDateRange, parsePagination } from "../utils/pagination";
import { AuditLogModel } from "../models";

export const auditRouter = Router();

auditRouter.use(auth, tenant);

auditRouter.get(
  "/",
  rbac("audit:read"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const { from, to } = parseDateRange(req.query);
    const filter: Record<string, unknown> = { tenantId: req.tenantId };
    if (typeof req.query.entity === "string") filter.entity = req.query.entity;
    if (typeof req.query.user === "string") filter.userId = req.query.user;
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    const [items, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    res.json({
      items: items.map((log) => ({
        id: log._id.toString(),
        userId: log.userId.toString(),
        action: log.action,
        entity: log.entity,
        entityId: log.entityId.toString(),
        changes: log.changes,
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  }),
);