import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  adminCreateUserSchema,
  adminUpdateRoleSchema,
  adminUpdateUserSchema,
  createCompanySchema,
  roleSchema,
  superadminLoginSchema,
  updateCompanySchema,
  userCreateSchema,
} from "@erp/shared";
import type { PlanTier } from "@erp/shared";
import { env } from "../config/env";
import { ALL_PERMISSIONS, PLAN_LIMITS, ROLE_PRESETS } from "../constants/permissions";
import { requireSuperAdmin } from "../middleware/superadmin";
import { validate } from "../middleware/validate";
import { CompanyModel, RoleModel, SuperAdminModel, UserModel } from "../models";
import { seedPresetRoles, serializeUser } from "../services/auth.service";
import { serializeCompany } from "../utils/serializers";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/errors";
import { parsePagination } from "../utils/pagination";
import { removeUploadedFile, saveBase64Image } from "../utils/uploads";

export const adminRouter = Router();

adminRouter.post(
  "/auth/login",
  validate(superadminLoginSchema),
  asyncHandler(async (req, res) => {
    const superadmin = await SuperAdminModel.findOne({ email: req.body.email.toLowerCase() });
    if (!superadmin || !(await bcrypt.compare(req.body.password, superadmin.passwordHash))) {
      throw new AppError(401, "invalid credentials");
    }
    const accessToken = jwt.sign(
      { sub: superadmin._id.toString(), scope: "superadmin", permissions: ["superadmin"] },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({ accessToken });
  }),
);

adminRouter.get(
  "/me",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const superadmin = await SuperAdminModel.findById(req.superadminId);
    if (!superadmin) {
      throw new AppError(401, "session no longer valid");
    }
    res.json({ id: superadmin._id.toString(), email: superadmin.email, name: superadmin.name });
  }),
);

adminRouter.get(
  "/companies",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const [companies, total] = await Promise.all([
      CompanyModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CompanyModel.countDocuments(),
    ]);
    const counts = await UserModel.aggregate([
      { $match: { companyId: { $in: companies.map((c) => c._id) } } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]);
    const usersCount = new Map(counts.map((row) => [row._id.toString(), row.count]));
    res.json({
      items: companies.map((company) => ({ ...serializeCompany(company), usersCount: usersCount.get(company._id.toString()) ?? 0 })),
      total,
      page,
      pageSize,
    });
  }),
);

adminRouter.post(
  "/companies",
  requireSuperAdmin,
  validate(createCompanySchema),
  asyncHandler(async (req, res) => {
    const exists = await CompanyModel.exists({ slug: req.body.slug });
    if (exists) {
      throw new AppError(409, "company slug already exists");
    }
    const session = await mongoose.startSession();
    try {
      const [company] = await CompanyModel.create(
        [
          {
            name: req.body.name,
            slug: req.body.slug,
            plan: req.body.plan,
            isActive: true,
            settings: req.body.settings,
            limits: PLAN_LIMITS[req.body.plan as PlanTier],
          },
        ],
        { session },
      );
      await RoleModel.create(
        [{ companyId: company._id, name: "admin", permissions: [...ALL_PERMISSIONS], isSystem: true }],
        { session },
      );
      await seedPresetRoles(company._id.toString(), { session });
      res.status(201).json(serializeCompany(company));
    } finally {
      await session.endSession();
    }
  }),
);

adminRouter.patch(
  "/companies/:id",
  requireSuperAdmin,
  validate(updateCompanySchema),
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    if (req.body.name !== undefined) {
      company.name = req.body.name;
    }
    if (req.body.plan !== undefined) {
      company.plan = req.body.plan;
      company.limits = { ...PLAN_LIMITS[req.body.plan as PlanTier] };
    }
    if (req.body.isActive !== undefined) {
      company.isActive = req.body.isActive;
    }
    if (req.body.limits !== undefined) {
      if (req.body.limits.maxUsers !== undefined) company.limits.maxUsers = req.body.limits.maxUsers;
      if (req.body.limits.maxProducts !== undefined) company.limits.maxProducts = req.body.limits.maxProducts;
      if (req.body.limits.features !== undefined) company.limits.features = req.body.limits.features;
    }
    await company.save();
    res.json(serializeCompany(company));
  }),
);

adminRouter.post(
  "/companies/:id/logo",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    if (typeof req.body.image !== "string") {
      throw new AppError(400, "image is required");
    }
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const previousLogo = company.logoUrl;
    const logoUrl = await saveBase64Image(req.body.image, "logos");
    if (previousLogo) {
      await removeUploadedFile(previousLogo, "logos");
    }
    company.logoUrl = logoUrl;
    await company.save();
    res.json({ logoUrl });
  }),
);

adminRouter.delete(
  "/companies/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    if (company.isActive) {
      company.isActive = false;
      await company.save();
    }
    res.json({ ok: true });
  }),
);

adminRouter.get(
  "/companies/:id/roles",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const roles = await RoleModel.find({ companyId: company._id }).sort({ isSystem: -1, name: 1 }).lean();
    res.json(
      roles.map((role) => ({
        id: role._id.toString(),
        name: role.name,
        permissions: role.permissions,
        isSystem: role.isSystem,
      })),
    );
  }),
);

adminRouter.post(
  "/companies/:id/users",
  requireSuperAdmin,
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const userCount = await UserModel.countDocuments({ companyId: company._id });
    if (userCount >= company.limits.maxUsers) {
      throw new AppError(403, `plan limit reached: max ${company.limits.maxUsers} users`);
    }
    const role = req.body.roleId
      ? await RoleModel.findOne({ _id: req.body.roleId, companyId: company._id })
      : await RoleModel.findOne({ companyId: company._id, name: "user" });
    if (!role) {
      throw new AppError(400, "role does not exist in this company");
    }
    const exists = await UserModel.findOne({ email: req.body.email.toLowerCase() });
    if (exists) {
      throw new AppError(409, "email already registered");
    }
    const user = await UserModel.create({
      companyId: company._id,
      email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(req.body.password, 12),
      name: req.body.name,
      roleId: role._id,
      avatarUrl: req.body.avatarBase64 ? await saveBase64Image(req.body.avatarBase64, "avatars", "avatar") : null,
      isActive: true,
    });
    res.status(201).json(serializeUser(user));
  }),
);

adminRouter.get(
  "/users",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, limit } = parsePagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
    const filter: Record<string, unknown> = {};
    if (companyId) {
      if (!mongoose.isValidObjectId(companyId)) {
        throw new AppError(400, "invalid companyId");
      }
      filter.companyId = companyId;
    }
    if (search) {
      filter.$or = [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }];
    }
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(filter),
    ]);
    const companyIds = [...new Set(items.map((user) => user.companyId.toString()))];
    const roleIds = [...new Set(items.map((user) => user.roleId.toString()))];
    const [companies, roles] = await Promise.all([
      companyIds.length > 0 ? CompanyModel.find({ _id: { $in: companyIds } }).lean() : Promise.resolve([]),
      roleIds.length > 0 ? RoleModel.find({ _id: { $in: roleIds } }).lean() : Promise.resolve([]),
    ]);
    const companyNames = new Map(companies.map((c) => [c._id.toString(), c.name]));
    const roleNames = new Map(roles.map((r) => [r._id.toString(), r.name]));
    res.json({
      items: items.map((user) => ({
        ...serializeUser(user),
        companyName: companyNames.get(user.companyId.toString()) ?? "",
        roleName: roleNames.get(user.roleId.toString()) ?? "",
      })),
      total,
      page,
      pageSize,
    });
  }),
);

adminRouter.post(
  "/users",
  requireSuperAdmin,
  validate(adminCreateUserSchema),
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.body.companyId);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const userCount = await UserModel.countDocuments({ companyId: company._id });
    if (userCount >= company.limits.maxUsers) {
      throw new AppError(409, `plan limit reached: max ${company.limits.maxUsers} users`);
    }
    const role = req.body.roleId
      ? await RoleModel.findOne({ _id: req.body.roleId, companyId: company._id })
      : await RoleModel.findOne({ companyId: company._id, name: "user" });
    if (!role) {
      throw new AppError(400, "role does not exist in this company");
    }
    const exists = await UserModel.findOne({ email: req.body.email.toLowerCase() });
    if (exists) {
      throw new AppError(409, "email already registered");
    }
    const user = await UserModel.create({
      companyId: company._id,
      email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(req.body.password, 12),
      name: req.body.name,
      roleId: role._id,
      avatarUrl: req.body.avatarBase64 ? await saveBase64Image(req.body.avatarBase64, "avatars", "avatar") : null,
      isActive: true,
    });
    res.status(201).json({
      ...serializeUser(user),
      companyName: company.name,
      roleName: role.name,
    });
  }),
);

adminRouter.patch(
  "/users/:id",
  requireSuperAdmin,
  validate(adminUpdateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      throw new AppError(404, "user not found");
    }
    const targetCompanyId = req.body.companyId ?? user.companyId.toString();
    const company = await CompanyModel.findById(targetCompanyId);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    if (targetCompanyId !== user.companyId.toString()) {
      const userCount = await UserModel.countDocuments({ companyId: company._id });
      if (userCount >= company.limits.maxUsers) {
        throw new AppError(409, `plan limit reached: max ${company.limits.maxUsers} users`);
      }
    }
    if (req.body.roleId !== undefined) {
      const role = await RoleModel.findOne({ _id: req.body.roleId, companyId: company._id });
      if (!role) {
        throw new AppError(400, "role does not exist in this company");
      }
      user.roleId = role._id;
    } else if (targetCompanyId !== user.companyId.toString()) {
      const role = await RoleModel.findOne({ _id: user.roleId, companyId: company._id });
      if (!role) {
        throw new AppError(400, "role does not exist in this company");
      }
    }
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.companyId !== undefined) user.companyId = company._id;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    if (req.body.avatarBase64 !== undefined) {
      const avatarUrl = await saveBase64Image(req.body.avatarBase64, "avatars", "avatar");
      if (user.avatarUrl) {
        await removeUploadedFile(user.avatarUrl, "avatars");
      }
      user.avatarUrl = avatarUrl;
    }
    await user.save();
    res.json(serializeUser(user));
  }),
);

adminRouter.delete(
  "/users/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      throw new AppError(404, "user not found");
    }
    if (user.isActive) {
      user.isActive = false;
      await user.save();
    }
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/companies/:id/roles",
  requireSuperAdmin,
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    if (Object.keys(ROLE_PRESETS).includes(req.body.name)) {
      throw new AppError(400, "cannot create a role with a system preset name");
    }
    const exists = await RoleModel.exists({ companyId: company._id, name: req.body.name });
    if (exists) {
      throw new AppError(409, "role name already exists in this company");
    }
    const role = await RoleModel.create({
      companyId: company._id,
      name: req.body.name,
      permissions: req.body.permissions,
      isSystem: false,
    });
    res.status(201).json({ id: role._id.toString(), name: role.name, permissions: role.permissions, isSystem: role.isSystem });
  }),
);

adminRouter.patch(
  "/companies/:id/roles/:roleId",
  requireSuperAdmin,
  validate(adminUpdateRoleSchema),
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const role = await RoleModel.findOne({ _id: req.params.roleId, companyId: company._id });
    if (!role) {
      throw new AppError(404, "role not found in this company");
    }
    if (req.body.name !== undefined && req.body.name !== role.name) {
      if (role.isSystem) {
        throw new AppError(400, "system role name is locked");
      }
      const exists = await RoleModel.exists({ companyId: company._id, name: req.body.name });
      if (exists) {
        throw new AppError(409, "role name already exists in this company");
      }
      role.name = req.body.name;
    }
    if (req.body.permissions !== undefined) {
      role.permissions = req.body.permissions;
    }
    await role.save();
    res.json({ id: role._id.toString(), name: role.name, permissions: role.permissions, isSystem: role.isSystem });
  }),
);

adminRouter.delete(
  "/companies/:id/roles/:roleId",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      throw new AppError(404, "company not found");
    }
    const role = await RoleModel.findOne({ _id: req.params.roleId, companyId: company._id });
    if (!role) {
      throw new AppError(404, "role not found in this company");
    }
    if (role.isSystem) {
      throw new AppError(400, "system role cannot be deleted");
    }
    const assigned = await UserModel.exists({ companyId: company._id, roleId: role._id });
    if (assigned) {
      throw new AppError(409, "reassign members first");
    }
    await role.deleteOne();
    res.json({ ok: true });
  }),
);