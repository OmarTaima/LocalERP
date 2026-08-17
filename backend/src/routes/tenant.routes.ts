import { Router } from "express";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/errors";
import { TenantModel } from "../models";
import { writeAudit } from "../services/audit.service";

export const tenantRouter = Router();

tenantRouter.use(auth, tenant);

tenantRouter.get(
  "/settings",
  rbac("tenant:read"),
  asyncHandler(async (req, res) => {
    const tenantDoc = await TenantModel.findById(req.tenantId).lean();
    if (!tenantDoc) {
      throw new AppError(404, "tenant not found");
    }
    res.json({
      id: tenantDoc._id.toString(),
      name: tenantDoc.name,
      slug: tenantDoc.slug,
      plan: tenantDoc.plan,
      settings: tenantDoc.settings,
      limits: tenantDoc.limits,
    });
  }),
);

tenantRouter.patch(
  "/settings",
  rbac("tenant:write"),
  asyncHandler(async (req, res) => {
    const tenantDoc = await TenantModel.findById(req.tenantId);
    if (!tenantDoc) {
      throw new AppError(404, "tenant not found");
    }
    const before = JSON.parse(JSON.stringify(tenantDoc.settings));
    const settings = tenantDoc.settings;
    if (typeof req.body.currency === "string" && /^[A-Z]{3}$/.test(req.body.currency)) {
      settings.currency = req.body.currency;
    }
    if (typeof req.body.taxRate === "number" && req.body.taxRate >= 0 && req.body.taxRate <= 100) {
      settings.taxRate = req.body.taxRate;
    }
    if (typeof req.body.timezone === "string") {
      settings.timezone = req.body.timezone;
    }
    await tenantDoc.save();
    await writeAudit({
      tenantId: req.tenantId,
      userId: req.userId,
      action: "update",
      entity: "Tenant",
      entityId: tenantDoc._id.toString(),
      before: { settings: before },
      after: { settings: settings },
      ip: req.ip,
    });
    res.json({ settings });
  }),
);