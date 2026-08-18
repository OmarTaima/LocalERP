import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  totpCode: Joi.string().length(6).optional(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().min(20).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).required(),
  newPassword: Joi.string().min(8).pattern(/[A-Z]/, "uppercase").required(),
});

export const userCreateSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(80).required(),
  password: Joi.string().min(8).required(),
  roleId: Joi.string().min(1).optional(),
  avatarUrl: Joi.string().uri({ scheme: ["https"] }).allow(null).optional(),
});

export const roleSchema = Joi.object({
  name: Joi.string().min(2).max(40).required(),
  permissions: Joi.array().items(Joi.string().pattern(/^[a-z]+(:[a-z]+)+$/)).min(1).required(),
});

export const totpSetupSchema = Joi.object({
  password: Joi.string().min(8).required(),
});

export const totpVerifySchema = Joi.object({
  code: Joi.string().length(6).required(),
});

export const companySettingsUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(80).optional(),
  currency: Joi.string().pattern(/^[A-Z]{3}$/).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  timezone: Joi.string().optional(),
  settings: Joi.object({
    currency: Joi.string().pattern(/^[A-Z]{3}$/).optional(),
    taxRate: Joi.number().min(0).max(100).optional(),
    timezone: Joi.string().optional(),
  }).optional(),
}).or("name", "currency", "taxRate", "timezone", "settings");