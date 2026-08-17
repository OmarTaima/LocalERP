import Joi from "joi";

const httpsUri = Joi.string().uri({ scheme: ["https"] });

export const avatarUploadSchema = Joi.object({
  avatarUrl: httpsUri.required(),
});

export const logoUploadSchema = Joi.object({
  logoUrl: httpsUri.required(),
});