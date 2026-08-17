import { Router } from "express";
import { userCreateSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import { serializeUser } from "../services/auth.service";
import { AppError } from "../utils/errors";
import { RoleModel, TenantModel, UserModel } from "../models";
import bcrypt from "bcryptjs";
import { writeAudit } from "../services/audit.service";

export const userRouter = Router();

userRouter.use(auth, tenant);

userRouter.get(
  "/",
  rbac("auth:users:read"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const filter = {
      tenantId: req.tenantId,
      ...(search ? { $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] } : {}),
    };
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(filter),
    ]);
    res.json({ items: items.map(serializeUser), total, page, pageSize });
  }),
);

userRouter.post(
  "/",
  rbac("auth:users:write"),
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    const tenantDoc = await TenantModel.findById(req.tenantId);
    if (!tenantDoc) {
      throw new AppError(404, "tenant not found");
    }
    const userCount = await UserModel.countDocuments({ tenantId: req.tenantId });
    if (userCount >= tenantDoc.limits.maxUsers) {
      throw new AppError(403, `plan limit reached: max ${tenantDoc.limits.maxUsers} users`);
    }
    const role = req.body.roleId
      ? await RoleModel.findOne({ _id: req.body.roleId, tenantId: req.tenantId })
      : await RoleModel.findOne({ tenantId: req.tenantId, name: "user" });
    if (!role) {
      throw new AppError(400, "role does not exist in this tenant");
    }
    const exists = await UserModel.findOne({ email: req.body.email.toLowerCase() });
    if (exists) {
      throw new AppError(409, "email already registered");
    }
    const user = await UserModel.create({
      tenantId: req.tenantId,
      email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(req.body.password, 12),
      name: req.body.name,
      roleId: role._id,
      isActive: true,
    });
    await writeAudit({
      tenantId: req.tenantId,
      userId: req.userId,
      action: "create",
      entity: "User",
      entityId: user._id.toString(),
      after: { email: user.email, roleId: role._id.toString() },
      ip: req.ip,
    });
    res.status(201).json(serializeUser(user));
  }),
);

userRouter.patch(
  "/:id",
  rbac("auth:users:write"),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!user) {
      throw new AppError(404, "user not found");
    }
    const before = serializeUser(user);
    const updates: Record<string, unknown> = {};
    if (typeof req.body.name === "string") updates.name = req.body.name;
    if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;
    if (typeof req.body.roleId === "string") {
      const role = await RoleModel.findOne({ _id: req.body.roleId, tenantId: req.tenantId });
      if (!role) throw new AppError(400, "role does not exist in this tenant");
      updates.roleId = role._id;
    }
    Object.assign(user, updates);
    await user.save();
    const after = serializeUser(user);
    await writeAudit({
      tenantId: req.tenantId,
      userId: req.userId,
      action: "update",
      entity: "User",
      entityId: user._id.toString(),
      before,
      after,
      ip: req.ip,
    });
    res.json(after);
  }),
);

userRouter.delete(
  "/:id",
  rbac("auth:users:write"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.userId) {
      throw new AppError(400, "cannot deactivate your own account");
    }
    const user = await UserModel.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!user) {
      throw new AppError(404, "user not found");
    }
    user.isActive = false;
    await user.save();
    await writeAudit({
      tenantId: req.tenantId,
      userId: req.userId,
      action: "delete",
      entity: "User",
      entityId: user._id.toString(),
      before: { isActive: true },
      after: { isActive: false },
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);