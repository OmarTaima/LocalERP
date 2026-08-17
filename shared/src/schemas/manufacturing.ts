import Joi from "joi";

export const bomSchema = Joi.object({
  productId: Joi.string().min(1).required(),
  components: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        quantity: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .required(),
  outputQuantity: Joi.number().positive().default(1),
});

export const bomUpdateSchema = Joi.object({
  components: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        quantity: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .optional(),
  outputQuantity: Joi.number().positive().optional(),
});

export const workCenterSchema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  costPerHour: Joi.number().min(0).required(),
  capacity: Joi.number().positive().required(),
});

export const workCenterUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  costPerHour: Joi.number().min(0).optional(),
  capacity: Joi.number().positive().optional(),
  isActive: Joi.boolean().optional(),
});

export const workOrderSchema = Joi.object({
  bomId: Joi.string().min(1).required(),
  quantity: Joi.number().integer().positive().required(),
  workCenterId: Joi.string().min(1).required(),
  plannedHours: Joi.number().min(0).required(),
});