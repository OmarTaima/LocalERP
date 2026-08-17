import { Router } from "express";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/errors";
import { CompanyModel } from "../models";
import { serializeCompany } from "../utils/serializers";
import { writeAudit } from "../services/audit.service";

export const companyRouter = Router();

companyRouter.use(auth, company);

companyRouter.get(
  "/settings",
  rbac("company:read"),
  asyncHandler(async (req, res) => {
    const companyDoc = await CompanyModel.findById(req.companyId).lean();
    if (!companyDoc) {
      throw new AppError(404, "company not found");
    }
    res.json(serializeCompany(companyDoc));
  }),
);

companyRouter.patch(
  "/settings",
  rbac("company:write"),
  asyncHandler(async (req, res) => {
    const companyDoc = await CompanyModel.findById(req.companyId);
    if (!companyDoc) {
      throw new AppError(404, "company not found");
    }
    const before = JSON.parse(JSON.stringify(companyDoc.settings));
    const settings = companyDoc.settings;
    if (typeof req.body.currency === "string" && /^[A-Z]{3}$/.test(req.body.currency)) {
      settings.currency = req.body.currency;
    }
    if (typeof req.body.taxRate === "number" && req.body.taxRate >= 0 && req.body.taxRate <= 100) {
      settings.taxRate = req.body.taxRate;
    }
    if (typeof req.body.timezone === "string") {
      settings.timezone = req.body.timezone;
    }
    await companyDoc.save();
    await writeAudit({
      companyId: req.companyId,
      userId: req.userId,
      action: "update",
      entity: "Company",
      entityId: companyDoc._id.toString(),
      before: { settings: before },
      after: { settings: settings },
      ip: req.ip,
    });
    res.json({ settings });
  }),
);