import Joi from "joi";

const httpsUri = Joi.string().uri({ scheme: ["https"] });

export const directUploadSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  type: Joi.string().min(1).max(100).required(),
  folder: Joi.string().min(1).max(80).optional(),
});

export const avatarUploadSchema = Joi.object({
  avatarUrl: httpsUri.required(),
});

export const logoUploadSchema = Joi.object({
  logoUrl: httpsUri.required(),
});