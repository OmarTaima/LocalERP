import Joi from "joi";

export const superadminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

export const createCompanySchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  slug: Joi.string().min(2).max(40).pattern(/^[a-z0-9-]+$/).required(),
  plan: Joi.string().valid("starter", "pro", "enterprise").default("starter"),
  settings: Joi.object({
    currency: Joi.string().pattern(/^[A-Z]{3}$/).default("USD"),
    taxRate: Joi.number().min(0).max(100).default(0),
    timezone: Joi.string().default("UTC"),
  }).default({ currency: "USD", taxRate: 0, timezone: "UTC" }),
});

export const updateCompanySchema = Joi.object({
  name: Joi.string().min(2).max(80).optional(),
  plan: Joi.string().valid("starter", "pro", "enterprise").optional(),
  isActive: Joi.boolean().optional(),
  limits: Joi.object({
    maxUsers: Joi.number().integer().positive().optional(),
    maxProducts: Joi.number().integer().positive().optional(),
    features: Joi.array().items(Joi.string()).optional(),
  }).optional(),
});

export const adminCreateUserSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  companyId: Joi.string().min(1).required(),
  roleId: Joi.string().min(1).optional(),
  avatarUrl: Joi.string().uri({ scheme: ["https"] }).allow(null).optional(),
});

export const adminUpdateUserSchema = Joi.object({
  name: Joi.string().min(2).max(80).optional(),
  roleId: Joi.string().min(1).optional(),
  companyId: Joi.string().min(1).optional(),
  isActive: Joi.boolean().optional(),
  avatarUrl: Joi.string().uri({ scheme: ["https"] }).allow(null).optional(),
}).min(1);

export const adminUpdateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(40).optional(),
  permissions: Joi.array().items(Joi.string().pattern(/^[a-z]+(:[a-z]+)+$/)).min(1).optional(),
}).min(1);