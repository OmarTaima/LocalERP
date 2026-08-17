import { Router } from "express";
import { userCreateSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import { serializeUser } from "../services/auth.service";
import { AppError } from "../utils/errors";
import { RoleModel, CompanyModel, UserModel } from "../models";
import bcrypt from "bcryptjs";
import { writeAudit } from "../services/audit.service";
import { deleteImage } from "../utils/r2";

export const userRouter = Router();

userRouter.use(auth, company);

userRouter.get(
  "/",
  rbac("users:read"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const filter = {
      companyId: req.companyId,
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
  rbac("users:create"),
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    const companyDoc = await CompanyModel.findById(req.companyId);
    if (!companyDoc) {
      throw new AppError(404, "company not found");
    }
    const userCount = await UserModel.countDocuments({ companyId: req.companyId });
    if (userCount >= companyDoc.limits.maxUsers) {
      throw new AppError(403, `plan limit reached: max ${companyDoc.limits.maxUsers} users`);
    }
    const role = req.body.roleId
      ? await RoleModel.findOne({ _id: req.body.roleId, companyId: req.companyId })
      : await RoleModel.findOne({ companyId: req.companyId, name: "user" });
    if (!role) {
      throw new AppError(400, "role does not exist in this company");
    }
    const exists = await UserModel.findOne({ email: req.body.email.toLowerCase() });
    if (exists) {
      throw new AppError(409, "email already registered");
    }
    const user = await UserModel.create({
      companyId: req.companyId,
      email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(req.body.password, 12),
      name: req.body.name,
      roleId: role._id,
      avatarUrl: req.body.avatarUrl ?? null,
      isActive: true,
    });
    await writeAudit({
      companyId: req.companyId,
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
  rbac("users:write"),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!user) {
      throw new AppError(404, "user not found");
    }
    const before = serializeUser(user);
    const updates: Record<string, unknown> = {};
    if (typeof req.body.name === "string") updates.name = req.body.name;
    if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;
    if (typeof req.body.roleId === "string") {
      const role = await RoleModel.findOne({ _id: req.body.roleId, companyId: req.companyId });
      if (!role) throw new AppError(400, "role does not exist in this company");
      updates.roleId = role._id;
    }
    if (req.body.avatarUrl !== undefined) {
      const previousAvatar = user.avatarUrl;
      user.avatarUrl = req.body.avatarUrl;
      if (previousAvatar) {
        await deleteImage(previousAvatar);
      }
      updates.avatarUrl = user.avatarUrl;
    }
    Object.assign(user, updates);
    await user.save();
    const after = serializeUser(user);
    await writeAudit({
      companyId: req.companyId,
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
  rbac("users:delete"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.userId) {
      throw new AppError(400, "cannot deactivate your own account");
    }
    const user = await UserModel.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!user) {
      throw new AppError(404, "user not found");
    }
    user.isActive = false;
    await user.save();
    await writeAudit({
      companyId: req.companyId,
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