import Joi from "joi";

export const supplierSchema = Joi.object({
  name: Joi.string().min(1).max(160).required(),
  contactName: Joi.string().max(120).default(""),
  email: Joi.string().email().default(""),
  phone: Joi.string().max(30).default(""),
  address: Joi.string().max(300).default(""),
  paymentTerms: Joi.string().max(80).default(""),
});

export const supplierUpdateSchema = supplierSchema.fork(
  ["name", "contactName", "email", "phone", "address", "paymentTerms"],
  (schema) => schema.optional(),
);

const poLineSchema = Joi.object({
  productId: Joi.string().min(1).required(),
  quantity: Joi.number().integer().positive().required(),
  unitCost: Joi.number().min(0).required(),
  batchId: Joi.string().optional(),
});

export const purchaseOrderSchema = Joi.object({
  supplierId: Joi.string().min(1).required(),
  items: Joi.array().items(poLineSchema).min(1).required(),
  expectedDate: Joi.string().isoDate().required(),
});

export const purchaseOrderUpdateSchema = Joi.object({
  items: Joi.array().items(poLineSchema).min(1).optional(),
  expectedDate: Joi.string().isoDate().optional(),
});

export const approveSchema = Joi.object({
  approved: Joi.boolean().required(),
  note: Joi.string().max(300).optional(),
});