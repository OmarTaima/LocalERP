import Joi from "joi";
import { IMPORT_TYPES } from "../models/system";

export const importSchema = Joi.object({
  type: Joi.string().valid(...IMPORT_TYPES).required(),
  data: Joi.string().min(1).required(),
});

export const exportSchema = Joi.object({
  type: Joi.string().valid(...IMPORT_TYPES).required(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
});