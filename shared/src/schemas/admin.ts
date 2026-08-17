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
  plan: Joi.string().valid("starter", "pro", "enterprise").optional(),
  isActive: Joi.boolean().optional(),
  limits: Joi.object({
    maxUsers: Joi.number().integer().positive().optional(),
    maxProducts: Joi.number().integer().positive().optional(),
    features: Joi.array().items(Joi.string()).optional(),
  }).optional(),
});