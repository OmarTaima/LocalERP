import Joi from "joi";

const productVariantSchema = Joi.object({
  name: Joi.string().min(1).required(),
  options: Joi.array().items(Joi.string().min(1)).min(1).required(),
  sku: Joi.string().min(1).required(),
  price: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional(),
  barcode: Joi.string().optional(),
});

export const productCreateSchema = Joi.object({
  sku: Joi.string().min(1).max(64).required(),
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).default(""),
  categoryId: Joi.string().allow(null).optional(),
  brand: Joi.string().max(100).default(""),
  price: Joi.number().min(0).required(),
  cost: Joi.number().min(0).required(),
  barcode: Joi.string().max(64).default(""),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  images: Joi.array().items(Joi.string().uri()).default([]),
  image: Joi.string().optional(),
  variants: Joi.array().items(productVariantSchema).default([]),
});

export const productUpdateSchema = Joi.object({
  sku: Joi.string().min(1).max(64).optional(),
  name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(2000).optional(),
  categoryId: Joi.string().allow(null).optional(),
  brand: Joi.string().max(100).optional(),
  price: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional(),
  barcode: Joi.string().max(64).optional(),
  lowStockThreshold: Joi.number().integer().min(0).optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  image: Joi.string().optional(),
  variants: Joi.array().items(productVariantSchema).optional(),
});

export const categorySchema = Joi.object({
  name: Joi.string().min(1).max(80).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).optional(),
  parentId: Joi.string().allow(null).optional(),
  order: Joi.number().integer().default(0),
});

export const stockAdjustSchema = Joi.object({
  warehouseId: Joi.string().min(1).required(),
  quantity: Joi.number().integer().not(0).messages({ "number.invalid": "quantity must be non-zero" }).required(),
  note: Joi.string().max(500).default(""),
});

export const warehouseSchema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  address: Joi.string().max(500).default(""),
  isDefault: Joi.boolean().default(false),
});

export const transferSchema = Joi.object({
  fromWarehouseId: Joi.string().min(1).required(),
  toWarehouseId: Joi.string()
    .min(1)
    .invalid(Joi.ref("fromWarehouseId"))
    .messages({ "any.invalid": "source and destination must differ" })
    .required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        quantity: Joi.number().integer().positive().required(),
        batchId: Joi.string().optional(),
      }),
    )
    .min(1)
    .required(),
});

export const taxRuleSchema = Joi.object({
  name: Joi.string().min(1).max(80).required(),
  rate: Joi.number().min(0).max(100).required(),
  appliesTo: Joi.string().valid("product", "category", "region").required(),
  region: Joi.string().allow(null).optional(),
  categoryId: Joi.string().allow(null).optional(),
  isActive: Joi.boolean().default(true),
});

export const reorderRuleSchema = Joi.object({
  productId: Joi.string().min(1).required(),
  warehouseId: Joi.string().min(1).required(),
  minQuantity: Joi.number().min(0).required(),
  maxQuantity: Joi.number().positive().min(1).required(),
  enabled: Joi.boolean().default(true),
}).custom((value: { minQuantity: number; maxQuantity: number }, helpers) => {
  if (value.maxQuantity <= value.minQuantity) {
    return helpers.error("reorder.invalidRange");
  }
  return value;
}, "reorder range").messages({ "reorder.invalidRange": "maxQuantity must be greater than minQuantity" });

export const priceListSchema = Joi.object({
  name: Joi.string().min(1).max(80).required(),
  customerSegmentIds: Joi.array().items(Joi.string().min(1)).default([]),
  isDefault: Joi.boolean().default(false),
});

export const priceListItemBulkSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        price: Joi.number().min(0).required(),
        minQuantity: Joi.number().integer().min(1).default(1),
      }),
    )
    .min(1)
    .required(),
});

export const mrpActionSchema = Joi.object({
  status: Joi.string().valid("actioned", "dismissed").required(),
});