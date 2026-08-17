import { Router } from "express";
import { importSchema, exportSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import {
  dashboardAlerts,
  dashboardApprovals,
  dashboardStats,
  exportAuditLogs,
  fxRevaluation,
  getExportJob,
  getImportJob,
  queueExportJob,
  queueImportJob,
} from "../services/system.service";
import { runDueRecurringInvoices } from "../services/sales.service";

export const systemRouter = Router();

systemRouter.use(auth, tenant);

systemRouter.get("/dashboard/stats", rbac("dashboard:read"), asyncHandler(async (req, res) => {
  res.json(
    await dashboardStats(req.tenantId, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    }),
  );
}));

systemRouter.get("/dashboard/approvals", rbac("approvals:read"), asyncHandler(async (req, res) => {
  res.json(await dashboardApprovals(req.tenantId));
}));

systemRouter.get("/dashboard/alerts", rbac("dashboard:read"), asyncHandler(async (req, res) => {
  res.json(await dashboardAlerts(req.tenantId));
}));

systemRouter.post("/reports/fx-revaluation", rbac("finance:write"), asyncHandler(async (req, res) => {
  res.json(await fxRevaluation(req.tenantId, req.userId));
}));

systemRouter.post("/recurring-invoices/run", rbac("sales:write"), asyncHandler(async (req, res) => {
  const count = await runDueRecurringInvoices(req.tenantId);
  res.json({ ran: count });
}));

systemRouter.get("/audit-logs/export", rbac("audit:read"), asyncHandler(async (req, res) => {
  const result = await exportAuditLogs(req.tenantId, {
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
  res.send(result.csv);
}));

systemRouter.post("/imports", rbac("imports:write"), validate(importSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await queueImportJob(req.tenantId, req.userId, req.body));
}));

systemRouter.get("/imports/:id", rbac("imports:read"), asyncHandler(async (req, res) => {
  res.json(await getImportJob(req.tenantId, req.params.id));
}));

systemRouter.get("/exports", rbac("exports:read"), validate(exportSchema, "query"), asyncHandler(async (req, res) => {
  const result = await queueExportJob(req.tenantId, req.userId, req.query as { type: "products" | "customers" | "orders" | "employees"; from?: string; to?: string });
  res.status(201).json(result);
}));

systemRouter.get("/exports/:id/download", rbac("exports:read"), asyncHandler(async (req, res) => {
  const job = await getExportJob(req.tenantId, req.params.id);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${job.type}.csv`);
  res.send(job.content);
}));