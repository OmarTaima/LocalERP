import mongoose from "mongoose";
import type { OrderLine, OrderStatus, OrderTotals } from "@erp/shared";
import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { moveStock } from "./inventory.service";
import { nextNumber } from "../models/counter";
import {
  CustomerModel,
  PaymentModel,
  ProductModel,
  QuoteModel,
  RecurringInvoiceModel,
  RmaModel,
  SalesOrderModel,
  ShipmentModel,
  WarehouseModel,
  type CustomerDoc,
  type PaymentDoc,
  type QuoteDoc,
  type RmaDoc,
  type SalesOrderDoc,
  type ShipmentDoc,
  type RecurringInvoiceDoc,
} from "../models";

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  quote: ["draft", "cancelled"],
  draft: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "paid"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export type OrderLineInput = {
  productId: string;
  name?: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  taxRate?: number;
  batchId?: string;
};

export async function enrichLines(companyId: string, lines: OrderLineInput[]): Promise<OrderLine[]> {
  return Promise.all(
    lines.map(async (line) => {
      const product = await ProductModel.findOne({ _id: line.productId, companyId });
      if (!product) throw new AppError(400, `product ${line.productId} does not exist`);
      return {
        productId: line.productId,
        name: line.name ?? product.name,
        sku: line.sku ?? product.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? product.price,
        taxRate: line.taxRate ?? 0,
        ...(line.batchId ? { batchId: line.batchId } : {}),
      };
    }),
  );
}

export function computeTotals(items: OrderLine[], shipping = 0, discount = 0): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0);
  const total = Math.max(0, subtotal + tax + shipping - discount);
  return { subtotal: round2(subtotal), tax: round2(tax), shipping: round2(shipping), discount: round2(discount), total: round2(total) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function requireCustomer(companyId: string, customerId: string): Promise<CustomerDoc> {
  const customer = await CustomerModel.findOne({ _id: customerId, companyId });
  if (!customer) throw new AppError(400, "customer does not exist");
  return customer;
}

function serializeCustomer(doc: CustomerDoc) {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    phone: doc.phone,
    addresses: doc.addresses,
    segmentId: doc.segmentId ? doc.segmentId.toString() : null,
    creditLimit: doc.creditLimit,
    tags: doc.tags,
    notes: doc.notes,
    totalSpent: doc.totalSpent,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listCustomers(companyId: string, query: { search?: string; status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
      { phone: { $regex: query.search, $options: "i" } },
    ];
  }
  const [docs, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    CustomerModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeCustomer), total, page, pageSize };
}

export async function createCustomer(companyId: string, userId: string, input: Record<string, unknown>) {
  const doc = await CustomerModel.create({ companyId, ...input, totalSpent: 0, status: "active" });
  const after = serializeCustomer(doc);
  await writeAudit({ companyId, userId, action: "create", entity: "Customer", entityId: doc._id.toString(), after: { name: doc.name, email: doc.email } });
  publish({ type: "sales.customer.created", payload: { companyId, customerId: doc._id.toString() } });
  return after;
}

export async function getCustomer(companyId: string, customerId: string) {
  const doc = await CustomerModel.findOne({ _id: customerId, companyId });
  if (!doc) throw new AppError(404, "customer not found");
  return serializeCustomer(doc);
}

export async function updateCustomer(companyId: string, userId: string, customerId: string, input: Record<string, unknown>) {
  const doc = await CustomerModel.findOne({ _id: customerId, companyId });
  if (!doc) throw new AppError(404, "customer not found");
  const before = { name: doc.name, email: doc.email, status: doc.status };
  for (const [key, value] of Object.entries(input)) {
    (doc as unknown as Record<string, unknown>)[key] = value;
  }
  await doc.save();
  const after = serializeCustomer(doc);
  await writeAudit({ companyId, userId, action: "update", entity: "Customer", entityId: customerId, before, after: { name: doc.name, email: doc.email, status: doc.status } });
  return after;
}

export async function listQuotes(companyId: string, query: { status?: string; customerId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  const [docs, total] = await Promise.all([
    QuoteModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    QuoteModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeQuote), total, page, pageSize };
}

function serializeQuote(doc: QuoteDoc) {
  return {
    id: doc._id.toString(),
    quoteNumber: doc.quoteNumber,
    customerId: doc.customerId.toString(),
    items: doc.items.map((item) => ({ productId: item.productId.toString(), name: item.name, sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, ...(item.batchId ? { batchId: item.batchId.toString() } : {}) })),
    totals: doc.totals,
    status: doc.status,
    validUntil: doc.validUntil.toISOString(),
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createQuote(companyId: string, userId: string, input: { customerId: string; items: OrderLineInput[]; validUntil: string }) {
  await requireCustomer(companyId, input.customerId);
  const items = await enrichLines(companyId, input.items);
  const doc = await QuoteModel.create({
    companyId,
    quoteNumber: await nextNumber(companyId, "quote", "QT"),
    customerId: input.customerId,
    items,
    totals: computeTotals(items),
    status: "draft",
    validUntil: new Date(input.validUntil),
    version: 1,
  });
  await writeAudit({ companyId, userId, action: "create", entity: "Quote", entityId: doc._id.toString(), after: { quoteNumber: doc.quoteNumber, total: doc.totals.total } });
  publish({ type: "sales.quote.created", payload: { companyId, quoteId: doc._id.toString(), quoteNumber: doc.quoteNumber } });
  return serializeQuote(doc);
}

export async function getQuote(companyId: string, quoteId: string) {
  const doc = await QuoteModel.findOne({ _id: quoteId, companyId });
  if (!doc) throw new AppError(404, "quote not found");
  return serializeQuote(doc);
}

export async function updateQuote(companyId: string, userId: string, quoteId: string, input: { items?: OrderLineInput[]; validUntil?: string; status?: "sent" | "declined" }) {
  const doc = await QuoteModel.findOne({ _id: quoteId, companyId });
  if (!doc) throw new AppError(404, "quote not found");
  const before = { status: doc.status, total: doc.totals.total };
  if (input.items) {
    if (doc.status !== "draft") throw new AppError(400, "items can only be changed while the quote is a draft");
    doc.items = await enrichLines(companyId, input.items);
    doc.totals = computeTotals(doc.items);
    doc.version += 1;
  }
  if (input.validUntil) doc.validUntil = new Date(input.validUntil);
  if (input.status) {
    if (doc.status !== "draft" && doc.status !== "sent") throw new AppError(400, `cannot move quote from ${doc.status} to ${input.status}`);
    doc.status = input.status;
  }
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "Quote", entityId: quoteId, before, after: { status: doc.status, total: doc.totals.total } });
  return serializeQuote(doc);
}

export async function convertQuote(companyId: string, userId: string, quoteId: string) {
  const doc = await QuoteModel.findOne({ _id: quoteId, companyId });
  if (!doc) throw new AppError(404, "quote not found");
  if (doc.status === "converted") throw new AppError(400, "quote already converted");
  if (doc.status !== "accepted" && doc.status !== "sent") throw new AppError(400, `quote must be accepted or sent before conversion (currently ${doc.status})`);
  const customer = await CustomerModel.findOne({ _id: doc.customerId, companyId });
  const shippingAddress = customer?.addresses[0];
  if (!shippingAddress) throw new AppError(400, "customer has no shipping address");
  const order = await SalesOrderModel.create({
    companyId,
    orderNumber: await nextNumber(companyId, "order", "ORD"),
    customerId: doc.customerId,
    quoteId: doc._id,
    items: doc.items,
    totals: computeTotals(doc.items),
    status: "draft",
    shippingAddress,
    notes: `converted from ${doc.quoteNumber}`,
    idempotencyKey: `QT-${doc._id.toString()}`,
    version: 1,
  });
  doc.status = "converted";
  doc.version += 1;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "Quote", entityId: quoteId, after: { status: "converted" } });
  publish({ type: "sales.quote.converted", payload: { companyId, quoteId, orderId: order._id.toString() } });
  return serializeOrder(order);
}

export async function listOrders(companyId: string, query: { status?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  const [docs, total] = await Promise.all([
    SalesOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SalesOrderModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeOrder), total, page, pageSize };
}

function serializeOrder(doc: SalesOrderDoc) {
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    customerId: doc.customerId.toString(),
    quoteId: doc.quoteId ? doc.quoteId.toString() : null,
    items: doc.items.map((item) => ({ productId: item.productId.toString(), name: item.name, sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, ...(item.batchId ? { batchId: item.batchId.toString() } : {}) })),
    totals: doc.totals,
    status: doc.status,
    shippingAddress: doc.shippingAddress,
    notes: doc.notes,
    idempotencyKey: doc.idempotencyKey,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createOrder(companyId: string, userId: string, input: {
  customerId: string;
  quoteId?: string;
  items: OrderLineInput[];
  shippingAddress: { label: string; street: string; city: string; country: string };
  notes?: string;
  idempotencyKey: string;
}) {
  const existing = await SalesOrderModel.findOne({ companyId, idempotencyKey: input.idempotencyKey });
  if (existing) return { ...serializeOrder(existing), duplicate: true };
  await requireCustomer(companyId, input.customerId);
  if (input.quoteId) {
    const quote = await QuoteModel.findOne({ _id: input.quoteId, companyId });
    if (!quote) throw new AppError(400, "quote does not exist");
  }
  const items = await enrichLines(companyId, input.items);
  const doc = await SalesOrderModel.create({
    companyId,
    orderNumber: await nextNumber(companyId, "order", "ORD"),
    customerId: input.customerId,
    quoteId: input.quoteId ?? null,
    items,
    totals: computeTotals(items),
    status: "draft",
    shippingAddress: input.shippingAddress,
    notes: input.notes ?? "",
    idempotencyKey: input.idempotencyKey,
    version: 1,
  });
  await writeAudit({ companyId, userId, action: "create", entity: "SalesOrder", entityId: doc._id.toString(), after: { orderNumber: doc.orderNumber, total: doc.totals.total } });
  publish({ type: "sales.order.created", payload: { companyId, orderId: doc._id.toString(), orderNumber: doc.orderNumber } });
  return serializeOrder(doc);
}

export async function getOrder(companyId: string, orderId: string) {
  const doc = await SalesOrderModel.findOne({ _id: orderId, companyId });
  if (!doc) throw new AppError(404, "order not found");
  const [payments, shipments, rmas] = await Promise.all([
    PaymentModel.find({ companyId, orderId: doc._id }).sort({ createdAt: 1 }).lean(),
    ShipmentModel.find({ companyId, orderId: doc._id }).sort({ createdAt: 1 }).lean(),
    RmaModel.find({ companyId, orderId: doc._id }).sort({ createdAt: 1 }).lean(),
  ]);
  return {
    ...serializeOrder(doc),
    timeline: {
      payments: payments.map((p) => ({ id: p._id.toString(), amount: p.amount, method: p.method, status: p.status, reference: p.reference, paidAt: p.paidAt ? p.paidAt.toISOString() : null })),
      shipments: shipments.map((s) => ({ id: s._id.toString(), carrier: s.carrier, trackingNumber: s.trackingNumber, status: s.status, shippedAt: s.shippedAt ? s.shippedAt.toISOString() : null, deliveredAt: s.deliveredAt ? s.deliveredAt.toISOString() : null })),
      rmas: rmas.map((r) => ({ id: r._id.toString(), rmaNumber: r.rmaNumber, status: r.status })),
    },
  };
}

export async function updateOrderStatus(companyId: string, userId: string, orderId: string, status: OrderStatus) {
  const doc = await SalesOrderModel.findOne({ _id: orderId, companyId });
  if (!doc) throw new AppError(404, "order not found");
  const allowed = ORDER_TRANSITIONS[doc.status];
  if (!allowed.includes(status)) throw new AppError(400, `cannot transition order from ${doc.status} to ${status}`);
  const before = { status: doc.status };
  doc.status = status;
  doc.version += 1;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "SalesOrder", entityId: orderId, before, after: { status: doc.status } });
  publish({ type: "sales.order.status_changed", payload: { companyId, orderId, status: doc.status } });
  return serializeOrder(doc);
}

export async function createPayment(companyId: string, userId: string, orderId: string, input: { amount: number; method: "card" | "transfer" | "cash" | "refund"; reference?: string; idempotencyKey: string }) {
  const existing = await PaymentModel.findOne({ companyId, idempotencyKey: input.idempotencyKey });
  if (existing) return { ...serializePayment(existing), duplicate: true };
  const order = await SalesOrderModel.findOne({ _id: orderId, companyId });
  if (!order) throw new AppError(404, "order not found");
  if (order.status !== "confirmed" && order.status !== "paid") throw new AppError(400, `payments require a confirmed order (currently ${order.status})`);
  const captured = await PaymentModel.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), orderId: order._id, status: "captured" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const alreadyPaid = captured[0]?.total ?? 0;
  if (alreadyPaid + input.amount > order.totals.total + 0.001) throw new AppError(400, "payment exceeds the outstanding balance");
  const doc = await PaymentModel.create({
    companyId,
    orderId: order._id,
    amount: input.amount,
    method: input.method,
    status: "captured",
    reference: input.reference ?? "",
    idempotencyKey: input.idempotencyKey,
    paidAt: new Date(),
  });
  const customer = await CustomerModel.findOne({ _id: order.customerId, companyId });
  if (customer) {
    customer.totalSpent += input.amount;
    await customer.save();
  }
  if (alreadyPaid + input.amount >= order.totals.total - 0.001 && order.status === "confirmed") {
    order.status = "paid";
    order.version += 1;
    await order.save();
  }
  await writeAudit({ companyId, userId, action: "create", entity: "Payment", entityId: doc._id.toString(), after: { amount: doc.amount, method: doc.method } });
  publish({ type: "sales.payment.captured", payload: { companyId, orderId, paymentId: doc._id.toString(), amount: doc.amount } });
  return serializePayment(doc);
}

function serializePayment(doc: PaymentDoc) {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId.toString(),
    amount: doc.amount,
    method: doc.method,
    status: doc.status,
    reference: doc.reference,
    idempotencyKey: doc.idempotencyKey,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listShipments(companyId: string, query: { status?: string; orderId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.orderId) filter.orderId = query.orderId;
  const [docs, total] = await Promise.all([
    ShipmentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ShipmentModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeShipment), total, page, pageSize };
}

function serializeShipment(doc: ShipmentDoc) {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId.toString(),
    carrier: doc.carrier,
    trackingNumber: doc.trackingNumber,
    pickList: doc.pickList.map((line) => ({ productId: line.productId.toString(), quantity: line.quantity, fromWarehouseId: line.fromWarehouseId.toString() })),
    status: doc.status,
    shippedAt: doc.shippedAt ? doc.shippedAt.toISOString() : null,
    deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createShipment(companyId: string, userId: string, input: { orderId: string; carrier: string; trackingNumber: string; pickList: Array<{ productId: string; quantity: number; fromWarehouseId: string }> }) {
  const order = await SalesOrderModel.findOne({ _id: input.orderId, companyId });
  if (!order) throw new AppError(404, "order not found");
  if (order.status !== "paid" && order.status !== "fulfilled") throw new AppError(400, `shipments require a paid or fulfilled order (currently ${order.status})`);
  for (const line of input.pickList) {
    const product = await ProductModel.findOne({ _id: line.productId, companyId });
    if (!product) throw new AppError(400, `product ${line.productId} does not exist`);
    const warehouse = await WarehouseModel.findOne({ _id: line.fromWarehouseId, companyId, isActive: true });
    if (!warehouse) throw new AppError(400, `warehouse ${line.fromWarehouseId} does not exist or is inactive`);
  }
  const doc = await ShipmentModel.create({
    companyId,
    orderId: order._id,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
    pickList: input.pickList,
    status: "draft",
  });
  await writeAudit({ companyId, userId, action: "create", entity: "Shipment", entityId: doc._id.toString(), after: { carrier: doc.carrier, status: "draft" } });
  publish({ type: "sales.shipment.created", payload: { companyId, shipmentId: doc._id.toString(), orderId: input.orderId } });
  return serializeShipment(doc);
}

export async function updateShipmentStatus(companyId: string, userId: string, shipmentId: string, input: { status: "packed" | "shipped" | "delivered"; trackingNumber?: string }) {
  const doc = await ShipmentModel.findOne({ _id: shipmentId, companyId });
  if (!doc) throw new AppError(404, "shipment not found");
  if (input.trackingNumber) doc.trackingNumber = input.trackingNumber;
  if (input.status === "packed") {
    if (doc.status !== "draft") throw new AppError(400, `cannot pack a ${doc.status} shipment`);
    doc.status = "packed";
  } else if (input.status === "shipped") {
    if (doc.status !== "packed") throw new AppError(400, "shipment must be packed before shipping");
    for (const line of doc.pickList) {
      await moveStock(
        companyId,
        userId,
        line.productId.toString(),
        line.fromWarehouseId.toString(),
        -line.quantity,
        "sold",
        doc._id.toString(),
        `shipment ${doc._id.toString()}`,
      );
    }
    doc.status = "shipped";
    doc.shippedAt = new Date();
  } else {
    if (doc.status !== "shipped") throw new AppError(400, "shipment must be shipped before delivery");
    doc.status = "delivered";
    doc.deliveredAt = new Date();
  }
  await doc.save();
  const order = await SalesOrderModel.findOne({ _id: doc.orderId, companyId });
  if (order) {
    const target: OrderStatus = doc.status === "shipped" ? "shipped" : "delivered";
    if (order.status !== target) {
      order.status = target;
      order.version += 1;
      await order.save();
    }
  }
  await writeAudit({ companyId, userId, action: "update", entity: "Shipment", entityId: shipmentId, after: { status: doc.status, trackingNumber: doc.trackingNumber } });
  if (doc.status === "shipped") publish({ type: "sales.shipment.shipped", payload: { companyId, shipmentId, orderId: doc.orderId.toString() } });
  return serializeShipment(doc);
}

export async function listRmas(companyId: string, query: { status?: string; orderId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.orderId) filter.orderId = query.orderId;
  const [docs, total] = await Promise.all([
    RmaModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    RmaModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeRma), total, page, pageSize };
}

function serializeRma(doc: RmaDoc) {
  return {
    id: doc._id.toString(),
    rmaNumber: doc.rmaNumber,
    orderId: doc.orderId.toString(),
    items: doc.items.map((item) => ({ productId: item.productId.toString(), quantity: item.quantity, batchId: item.batchId ? item.batchId.toString() : undefined, condition: item.condition })),
    reason: doc.reason,
    status: doc.status,
    restockedAt: doc.restockedAt ? doc.restockedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createRma(companyId: string, userId: string, input: { orderId: string; items: Array<{ productId: string; quantity: number; batchId?: string; condition: string }>; reason: string }) {
  const order = await SalesOrderModel.findOne({ _id: input.orderId, companyId });
  if (!order) throw new AppError(404, "order not found");
  if (order.status !== "shipped" && order.status !== "delivered") throw new AppError(400, "returns require a shipped or delivered order");
  const doc = await RmaModel.create({
    companyId,
    rmaNumber: await nextNumber(companyId, "rma", "RMA"),
    orderId: order._id,
    items: input.items,
    reason: input.reason,
    status: "requested",
  });
  await writeAudit({ companyId, userId, action: "create", entity: "Rma", entityId: doc._id.toString(), after: { rmaNumber: doc.rmaNumber, reason: doc.reason } });
  publish({ type: "sales.rma.requested", payload: { companyId, rmaId: doc._id.toString(), orderId: input.orderId } });
  return serializeRma(doc);
}

export async function updateRmaStatus(companyId: string, userId: string, rmaId: string, status: "approved" | "rejected" | "received" | "refunded") {
  const doc = await RmaModel.findOne({ _id: rmaId, companyId });
  if (!doc) throw new AppError(404, "rma not found");
  if (status === "approved" || status === "rejected") {
    if (doc.status !== "requested") throw new AppError(400, `cannot move RMA from ${doc.status} to ${status}`);
  } else if (status === "received") {
    if (doc.status !== "approved") throw new AppError(400, "RMA must be approved before receiving");
    const warehouse = await WarehouseModel.findOne({ companyId, isDefault: true });
    if (!warehouse) throw new AppError(400, "no default warehouse for restocking");
    for (const item of doc.items) {
      await moveStock(
        companyId,
        userId,
        item.productId.toString(),
        warehouse._id.toString(),
        item.quantity,
        "returned",
        doc._id.toString(),
        `RMA restock ${doc.rmaNumber}`,
      );
    }
    doc.restockedAt = new Date();
  } else if (status === "refunded") {
    if (doc.status !== "received") throw new AppError(400, "RMA must be received before refunding");
    const order = await SalesOrderModel.findOne({ _id: doc.orderId, companyId });
    if (order && (order.status === "paid" || order.status === "fulfilled" || order.status === "shipped" || order.status === "delivered")) {
      const refundAmount = doc.items.reduce((sum, item) => sum + item.quantity * (order.items.find((line) => line.productId.toString() === item.productId.toString())?.unitPrice ?? 0), 0);
      await PaymentModel.create({
        companyId,
        orderId: order._id,
        amount: refundAmount,
        method: "refund",
        status: "captured",
        reference: doc.rmaNumber,
        idempotencyKey: `RMA-${doc._id.toString()}`,
        paidAt: new Date(),
      });
      order.status = "refunded";
      order.version += 1;
      await order.save();
    }
  }
  doc.status = status;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "Rma", entityId: rmaId, after: { status: doc.status } });
  if (status === "refunded") publish({ type: "sales.rma.refunded", payload: { companyId, rmaId, orderId: doc.orderId.toString() } });
  return serializeRma(doc);
}

export async function listRecurringInvoices(companyId: string, query: { status?: string; customerId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  const [docs, total] = await Promise.all([
    RecurringInvoiceModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    RecurringInvoiceModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeRecurring), total, page, pageSize };
}

function serializeRecurring(doc: RecurringInvoiceDoc) {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    items: doc.items.map((item) => ({ productId: item.productId ? item.productId.toString() : undefined, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice })),
    interval: doc.interval,
    nextRunAt: doc.nextRunAt.toISOString(),
    status: doc.status,
    dayOfPeriod: doc.dayOfPeriod,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createRecurringInvoice(companyId: string, userId: string, input: { customerId: string; items: Array<{ productId?: string; name: string; quantity: number; unitPrice: number }>; interval: "weekly" | "monthly" | "quarterly" | "yearly"; dayOfPeriod: number }) {
  await requireCustomer(companyId, input.customerId);
  const doc = await RecurringInvoiceModel.create({
    companyId,
    customerId: input.customerId,
    items: input.items,
    interval: input.interval,
    nextRunAt: nextRunFromDay(input.dayOfPeriod, input.interval),
    status: "active",
    dayOfPeriod: input.dayOfPeriod,
  });
  await writeAudit({ companyId, userId, action: "create", entity: "RecurringInvoice", entityId: doc._id.toString(), after: { interval: doc.interval, nextRunAt: doc.nextRunAt.toISOString() } });
  return serializeRecurring(doc);
}

function nextRunFromDay(dayOfPeriod: number, interval: string): Date {
  const now = new Date();
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfPeriod, 9, 0, 0));
  if (candidate.getTime() <= now.getTime()) {
    if (interval === "weekly") candidate.setUTCDate(candidate.getUTCDate() + 7);
    else if (interval === "monthly") candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    else if (interval === "quarterly") candidate.setUTCMonth(candidate.getUTCMonth() + 3);
    else candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate;
}

export async function updateRecurringStatus(companyId: string, userId: string, recurringId: string, status: "active" | "paused" | "cancelled") {
  const doc = await RecurringInvoiceModel.findOne({ _id: recurringId, companyId });
  if (!doc) throw new AppError(404, "recurring invoice not found");
  doc.status = status;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "RecurringInvoice", entityId: recurringId, after: { status: doc.status } });
  return serializeRecurring(doc);
}

export async function runDueRecurringInvoices(companyId: string): Promise<number> {
  const due = await RecurringInvoiceModel.find({ companyId, status: "active", nextRunAt: { $lte: new Date() } });
  let generated = 0;
  for (const recurring of due) {
    const lines: OrderLineInput[] = recurring.items
      .filter((item) => item.productId)
      .map((item) => ({ productId: item.productId!.toString(), name: item.name, quantity: item.quantity, unitPrice: item.unitPrice }));
    if (lines.length > 0) {
      const items = await enrichLines(companyId, lines);
      await SalesOrderModel.create({
        companyId,
        orderNumber: await nextNumber(companyId, "order", "ORD"),
        customerId: recurring.customerId,
        quoteId: null,
        items,
        totals: computeTotals(items),
        status: "draft",
        shippingAddress: { label: "Default", street: "", city: "", country: "" },
        notes: `recurring invoice ${recurring._id.toString()}`,
        idempotencyKey: `R${recurring._id.toString()}-${recurring.nextRunAt.toISOString()}`,
        version: 1,
      });
      generated++;
    }
    recurring.nextRunAt = nextRunFromDay(recurring.dayOfPeriod, recurring.interval);
    await recurring.save();
  }
  if (generated > 0) publish({ type: "sales.recurring.invoices_generated", payload: { companyId, count: generated } });
  return generated;
}