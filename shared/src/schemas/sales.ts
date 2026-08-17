import Joi from "joi";
import { ORDER_STATUSES } from "../models/common";

const orderLineSchema = Joi.object({
  productId: Joi.string().min(1).required(),
  name: Joi.string().min(1).required(),
  sku: Joi.string().min(1).required(),
  quantity: Joi.number().integer().positive().required(),
  unitPrice: Joi.number().min(0).required(),
  taxRate: Joi.number().min(0).required(),
  batchId: Joi.string().optional(),
});

const addressSchema = Joi.object({
  label: Joi.string().min(1).required(),
  street: Joi.string().min(1).required(),
  city: Joi.string().min(1).required(),
  country: Joi.string().min(1).required(),
});

export const orderCreateSchema = Joi.object({
  customerId: Joi.string().min(1).required(),
  quoteId: Joi.string().optional(),
  items: Joi.array().items(orderLineSchema).min(1).required(),
  shippingAddress: addressSchema.required(),
  notes: Joi.string().max(2000).default(""),
  idempotencyKey: Joi.string().min(8).max(64).required(),
});

export const orderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .required(),
});

export const paymentCreateSchema = Joi.object({
  amount: Joi.number().positive().required(),
  method: Joi.string().valid("card", "transfer", "cash", "refund").required(),
  reference: Joi.string().max(100).default(""),
  idempotencyKey: Joi.string().min(8).max(64).required(),
});

export const customerSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(1).max(120).required(),
  phone: Joi.string().max(30).default(""),
  addresses: Joi.array().items(addressSchema).default([]),
  segmentId: Joi.string().allow(null).optional(),
  creditLimit: Joi.number().min(0).default(0),
  tags: Joi.array().items(Joi.string().max(30)).default([]),
});

export const customerUpdateSchema = customerSchema.fork(
  ["email", "name", "phone", "addresses", "segmentId", "creditLimit", "tags"],
  (schema) => schema.optional(),
);

export const quoteSchema = Joi.object({
  customerId: Joi.string().min(1).required(),
  items: Joi.array().items(orderLineSchema).min(1).required(),
  validUntil: Joi.string().isoDate().required(),
});

export const quoteUpdateSchema = Joi.object({
  items: Joi.array().items(orderLineSchema).min(1).optional(),
  validUntil: Joi.string().isoDate().optional(),
  status: Joi.string().valid("sent", "declined").optional(),
});

export const shipmentStatusSchema = Joi.object({
  status: Joi.string().valid("packed", "shipped", "delivered").required(),
  trackingNumber: Joi.string().max(120).optional(),
});

export const shipmentSchema = Joi.object({
  orderId: Joi.string().min(1).required(),
  carrier: Joi.string().min(1).required(),
  trackingNumber: Joi.string().min(1).required(),
  pickList: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        quantity: Joi.number().integer().positive().required(),
        fromWarehouseId: Joi.string().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

export const rmaSchema = Joi.object({
  orderId: Joi.string().min(1).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().min(1).required(),
        quantity: Joi.number().integer().positive().required(),
        batchId: Joi.string().optional(),
        condition: Joi.string().max(200).default(""),
      }),
    )
    .min(1)
    .required(),
  reason: Joi.string().min(1).max(500).required(),
});

export const rmaStatusSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected", "received", "refunded").required(),
});

export const recurringInvoiceSchema = Joi.object({
  customerId: Joi.string().min(1).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().optional(),
        name: Joi.string().min(1).required(),
        quantity: Joi.number().integer().positive().required(),
        unitPrice: Joi.number().min(0).required(),
      }),
    )
    .min(1)
    .required(),
  interval: Joi.string().valid("weekly", "monthly", "quarterly", "yearly").required(),
  dayOfPeriod: Joi.number().integer().min(1).max(28).required(),
});

export const recurringStatusSchema = Joi.object({
  status: Joi.string().valid("active", "paused", "cancelled").required(),
});