import { Router } from "express";
import { roleSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import { AppError } from "../utils/errors";
import { RoleModel } from "../models";
import { writeAudit } from "../services/audit.service";

export const roleRouter = Router();

roleRouter.use(auth, company);

roleRouter.get(
  "/",
  rbac("roles:read"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const filter = { companyId: req.companyId };
    const [items, total] = await Promise.all([
      RoleModel.find(filter).sort({ isSystem: -1, name: 1 }).skip(skip).limit(limit).lean(),
      RoleModel.countDocuments(filter),
    ]);
    res.json({
      items: items.map((role) => ({
        id: role._id.toString(),
        companyId: role.companyId.toString(),
        name: role.name,
        permissions: role.permissions,
        isSystem: role.isSystem,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  }),
);

roleRouter.post(
  "/",
  rbac("roles:create"),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const exists = await RoleModel.exists({ companyId: req.companyId, name: req.body.name });
    if (exists) {
      throw new AppError(409, "role name already exists");
    }
    const role = await RoleModel.create({
      companyId: req.companyId,
      name: req.body.name,
      permissions: req.body.permissions,
      isSystem: false,
    });
    await writeAudit({
      companyId: req.companyId,
      userId: req.userId,
      action: "create",
      entity: "Role",
      entityId: role._id.toString(),
      after: { name: role.name, permissions: role.permissions },
      ip: req.ip,
    });
    res.status(201).json({ id: role._id.toString(), name: role.name, permissions: role.permissions });
  }),
);

roleRouter.patch(
  "/:id",
  rbac("roles:write"),
  asyncHandler(async (req, res) => {
    const role = await RoleModel.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!role) {
      throw new AppError(404, "role not found");
    }
    const before = { name: role.name, permissions: role.permissions };
    if (typeof req.body.name === "string" && !role.isSystem) role.name = req.body.name;
    if (Array.isArray(req.body.permissions)) role.permissions = req.body.permissions;
    await role.save();
    await writeAudit({
      companyId: req.companyId,
      userId: req.userId,
      action: "update",
      entity: "Role",
      entityId: role._id.toString(),
      before,
      after: { name: role.name, permissions: role.permissions },
      ip: req.ip,
    });
    res.json({ id: role._id.toString(), name: role.name, permissions: role.permissions });
  }),
);

roleRouter.delete(
  "/:id",
  rbac("roles:delete"),
  asyncHandler(async (req, res) => {
    const role = await RoleModel.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!role) {
      throw new AppError(404, "role not found");
    }
    if (role.isSystem) {
      throw new AppError(400, "system roles cannot be deleted");
    }
    await role.deleteOne();
    await writeAudit({
      companyId: req.companyId,
      userId: req.userId,
      action: "delete",
      entity: "Role",
      entityId: role._id.toString(),
      before: { name: role.name },
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);