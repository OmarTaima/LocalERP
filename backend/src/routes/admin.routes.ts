import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createCompanySchema, superadminLoginSchema, updateCompanySchema, userCreateSchema } from "@erp/shared";
import type { PlanTier } from "@erp/shared";
import { env } from "../config/env";
import { ALL_PERMISSIONS, PLAN_LIMITS } from "../constants/permissions";
import { requireSuperAdmin } from "../middleware/superadmin";
import { validate } from "../middleware/validate";
import { CompanyModel, RoleModel, SuperAdminModel, UserModel } from "../models";
import { seedPresetRoles, serializeUser } from "../services/auth.service";
import { serializeCompany } from "../utils/serializers";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/errors";
import { parsePagination } from "../utils/pagination";

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
      isActive: true,
    });
    res.status(201).json(serializeUser(user));
  }),
);