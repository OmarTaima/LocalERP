import { Router } from "express";
import { companySettingsUpdateSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/errors";
import { CompanyModel } from "../models";
import { serializeCompany } from "../utils/serializers";
import { removeUploadedFile, saveBase64Image } from "../utils/uploads";
import { writeAudit } from "../services/audit.service";

export const companyRouter = Router();

companyRouter.use(auth, company);

companyRouter.get(
  "/settings",
  rbac("companies:read"),
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
  rbac("companies:write"),
  validate(companySettingsUpdateSchema),
  asyncHandler(async (req, res) => {
    const companyDoc = await CompanyModel.findById(req.companyId);
    if (!companyDoc) {
      throw new AppError(404, "company not found");
    }
    const before = { name: companyDoc.name, settings: JSON.parse(JSON.stringify(companyDoc.settings)) };
    const settings = companyDoc.settings;
    if (typeof req.body.name === "string") {
      companyDoc.name = req.body.name;
    }
    if (typeof req.body.currency === "string") {
      settings.currency = req.body.currency;
    }
    if (typeof req.body.taxRate === "number") {
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
      before,
      after: { name: companyDoc.name, settings: settings },
      ip: req.ip,
    });
    res.json({ name: companyDoc.name, settings });
  }),
);

companyRouter.post(
  "/logo",
  rbac("companies:write"),
  asyncHandler(async (req, res) => {
    if (typeof req.body.image !== "string") {
      throw new AppError(400, "image is required");
    }
    const companyDoc = await CompanyModel.findById(req.companyId);
    if (!companyDoc) {
      throw new AppError(404, "company not found");
    }
    const previousLogo = companyDoc.logoUrl;
    const logoUrl = await saveBase64Image(req.body.image, "logos");
    if (previousLogo) {
      await removeUploadedFile(previousLogo, "logos");
    }
    companyDoc.logoUrl = logoUrl;
    await companyDoc.save();
    await writeAudit({
      companyId: req.companyId,
      userId: req.userId,
      action: "update",
      entity: "Company",
      entityId: companyDoc._id.toString(),
      before: { logoUrl: previousLogo },
      after: { logoUrl },
      ip: req.ip,
    });
    res.json({ logoUrl });
  }),
);