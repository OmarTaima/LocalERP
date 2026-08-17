import mongoose from "mongoose";
import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { moveStock } from "./inventory.service";
import { nextNumber } from "../models/counter";
import {
  AccountModel,
  ApprovalRequestModel,
  BatchModel,
  JournalEntryModel,
  ProductModel,
  PurchaseOrderModel,
  SupplierModel,
  WarehouseModel,
  type ApprovalRequestDoc,
  type PurchaseOrderDoc,
  type SupplierDoc,
} from "../models";

const APPROVAL_THRESHOLD = 1000;

export async function listSuppliers(companyId: string, query: { search?: string; isActive?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.isActive) filter.isActive = query.isActive === "true";
  if (query.search) {
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }, { email: { $regex: query.search, $options: "i" } }];
  }
  const [docs, total] = await Promise.all([
    SupplierModel.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SupplierModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeSupplier), total, page, pageSize };
}

function serializeSupplier(doc: SupplierDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    contactName: doc.contactName,
    email: doc.email,
    phone: doc.phone,
    address: doc.address,
    paymentTerms: doc.paymentTerms,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createSupplier(companyId: string, userId: string, input: Record<string, unknown>) {
  const doc = await SupplierModel.create({ companyId, ...input });
  await writeAudit({ companyId, userId, action: "create", entity: "Supplier", entityId: doc._id.toString(), after: { name: doc.name, email: doc.email } });
  publish({ type: "purchasing.supplier.created", payload: { companyId, supplierId: doc._id.toString() } });
  return serializeSupplier(doc);
}

export async function updateSupplier(companyId: string, userId: string, supplierId: string, input: Record<string, unknown>) {
  const doc = await SupplierModel.findOne({ _id: supplierId, companyId });
  if (!doc) throw new AppError(404, "supplier not found");
  const before = { name: doc.name, email: doc.email, isActive: doc.isActive };
  for (const [key, value] of Object.entries(input)) {
    (doc as unknown as Record<string, unknown>)[key] = value;
  }
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "Supplier", entityId: supplierId, before, after: { name: doc.name, isActive: doc.isActive } });
  return serializeSupplier(doc);
}

export async function deleteSupplier(companyId: string, userId: string, supplierId: string): Promise<void> {
  const doc = await SupplierModel.findOne({ _id: supplierId, companyId });
  if (!doc) throw new AppError(404, "supplier not found");
  const openPos = await PurchaseOrderModel.countDocuments({ companyId, supplierId: doc._id, status: { $nin: ["received", "closed", "rejected"] } });
  if (openPos > 0) throw new AppError(400, "supplier has open purchase orders");
  await writeAudit({ companyId, userId, action: "delete", entity: "Supplier", entityId: supplierId, before: { name: doc.name } });
  await doc.deleteOne();
}

export async function createPurchaseOrder(
  companyId: string,
  userId: string,
  input: { supplierId: string; items: Array<{ productId: string; quantity: number; unitCost: number; batchId?: string }>; expectedDate: string },
) {
  const supplier = await SupplierModel.findOne({ _id: input.supplierId, companyId });
  if (!supplier) throw new AppError(400, "supplier does not exist");
  for (const item of input.items) {
    const product = await ProductModel.findOne({ _id: item.productId, companyId });
    if (!product) throw new AppError(400, `product ${item.productId} does not exist`);
  }
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  let approval: mongoose.HydratedDocument<ApprovalRequestDoc> | null = null;
  if (total > APPROVAL_THRESHOLD) {
    approval = await ApprovalRequestModel.create({
      companyId,
      entityType: "purchase-order",
      entityId: new mongoose.Types.ObjectId(),
      amount: total,
      requestedBy: userId,
      chain: [],
      currentStep: 0,
      status: "pending",
      decisions: [],
    });
  }
  const doc = await PurchaseOrderModel.create({
    companyId,
    poNumber: await nextNumber(companyId, "po", "PO"),
    supplierId: input.supplierId,
    items: input.items,
    expectedDate: new Date(input.expectedDate),
    status: approval ? "pending-approval" : "sent",
    approvalId: approval?._id ?? null,
    grns: [],
    version: 1,
  });
  if (approval) {
    approval.entityId = doc._id;
    await approval.save();
  }
  await writeAudit({
    companyId,
    userId,
    action: "create",
    entity: "PurchaseOrder",
    entityId: doc._id.toString(),
    after: { poNumber: doc.poNumber, status: doc.status, total },
  });
  publish({ type: "purchasing.po.created", payload: { companyId, poId: doc._id.toString(), poNumber: doc.poNumber, status: doc.status } });
  return { ...serializePurchaseOrder(doc), total: round2(total) };
}

function serializePurchaseOrder(doc: PurchaseOrderDoc) {
  return {
    id: doc._id.toString(),
    poNumber: doc.poNumber,
    supplierId: doc.supplierId.toString(),
    items: doc.items.map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
      unitCost: item.unitCost,
      ...(item.batchId ? { batchId: item.batchId.toString() } : {}),
    })),
    expectedDate: doc.expectedDate.toISOString(),
    status: doc.status,
    approvalId: doc.approvalId ? doc.approvalId.toString() : null,
    grns: doc.grns.map((grn) => ({
      grnNumber: grn.grnNumber,
      receivedAt: grn.receivedAt.toISOString(),
      items: grn.items.map((item) => ({ productId: item.productId.toString(), quantity: item.quantity, unitCost: item.unitCost })),
    })),
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listPurchaseOrders(companyId: string, query: { status?: string; supplierId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  if (query.supplierId) filter.supplierId = query.supplierId;
  const [docs, total] = await Promise.all([
    PurchaseOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    PurchaseOrderModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializePurchaseOrder), total, page, pageSize };
}

export async function getPurchaseOrder(companyId: string, poId: string) {
  const doc = await PurchaseOrderModel.findOne({ _id: poId, companyId });
  if (!doc) throw new AppError(404, "purchase order not found");
  return serializePurchaseOrder(doc);
}

export async function updatePurchaseOrder(
  companyId: string,
  userId: string,
  poId: string,
  input: { items?: Array<{ productId: string; quantity: number; unitCost: number; batchId?: string }>; expectedDate?: string },
) {
  const doc = await PurchaseOrderModel.findOne({ _id: poId, companyId });
  if (!doc) throw new AppError(404, "purchase order not found");
  if (doc.status !== "draft" && doc.status !== "sent") throw new AppError(400, `purchase order cannot be edited in ${doc.status} state`);
  if (input.items) {
    for (const item of input.items) {
      const product = await ProductModel.findOne({ _id: item.productId, companyId });
      if (!product) throw new AppError(400, `product ${item.productId} does not exist`);
    }
    doc.items = input.items;
    doc.version += 1;
  }
  if (input.expectedDate) doc.expectedDate = new Date(input.expectedDate);
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "PurchaseOrder", entityId: poId, after: { poNumber: doc.poNumber, items: doc.items.length } });
  return serializePurchaseOrder(doc);
}

export async function approvePurchaseOrder(companyId: string, userId: string, poId: string, input: { approved: boolean; note?: string }) {
  const doc = await PurchaseOrderModel.findOne({ _id: poId, companyId });
  if (!doc) throw new AppError(404, "purchase order not found");
  if (doc.status !== "pending-approval" || !doc.approvalId) throw new AppError(400, "purchase order is not awaiting approval");
  const approval = await ApprovalRequestModel.findOne({ _id: doc.approvalId, companyId });
  if (!approval) throw new AppError(404, "approval request not found");
  if (approval.status !== "pending") throw new AppError(400, "approval already decided");
  approval.decisions.push({ approverId: new mongoose.Types.ObjectId(userId), approved: input.approved, note: input.note ?? "", at: new Date() });
  approval.status = input.approved ? "approved" : "rejected";
  approval.currentStep = approval.decisions.length;
  await approval.save();
  doc.status = input.approved ? "sent" : "rejected";
  doc.version += 1;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "PurchaseOrder", entityId: poId, after: { poNumber: doc.poNumber, status: doc.status, approved: input.approved } });
  publish({ type: "purchasing.po.approved", payload: { companyId, poId, approved: input.approved } });
  return serializePurchaseOrder(doc);
}

export async function receivePurchaseOrder(companyId: string, userId: string, poId: string) {
  const doc = await PurchaseOrderModel.findOne({ _id: poId, companyId });
  if (!doc) throw new AppError(404, "purchase order not found");
  if (doc.status !== "sent" && doc.status !== "partial") throw new AppError(400, `purchase order cannot be received in ${doc.status} state`);
  const warehouse = await WarehouseModel.findOne({ companyId, isDefault: true });
  if (!warehouse) throw new AppError(400, "no default warehouse for receiving goods");

  const receivedPerProduct = new Map<string, number>();
  for (const grn of doc.grns) {
    for (const item of grn.items) {
      receivedPerProduct.set(item.productId.toString(), (receivedPerProduct.get(item.productId.toString()) ?? 0) + item.quantity);
    }
  }

  const grnItems: Array<{ productId: string; quantity: number; unitCost: number }> = [];
  for (const line of doc.items) {
    const already = receivedPerProduct.get(line.productId.toString()) ?? 0;
    const remaining = line.quantity - already;
    if (remaining > 0) {
      grnItems.push({ productId: line.productId.toString(), quantity: remaining, unitCost: line.unitCost });
    }
  }
  if (grnItems.length === 0) throw new AppError(400, "all purchase order lines are already fully received");

  const grnNumber = await nextNumber(companyId, "grn", "GRN");
  const value = grnItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  for (const item of grnItems) {
    const batch = await BatchModel.create({
      companyId,
      productId: item.productId,
      lotNumber: `${grnNumber}-${item.productId.slice(-4).toUpperCase()}`,
      expiryDate: null,
      quantity: item.quantity,
      supplierId: doc.supplierId,
      receivedAt: new Date(),
    });
    await moveStock(companyId, userId, item.productId, warehouse._id.toString(), item.quantity, "received", doc._id.toString(), `GRN ${grnNumber}`, batch._id.toString());
  }
  doc.grns.push({
    grnNumber,
    receivedAt: new Date(),
    items: grnItems.map((item) => ({ productId: new mongoose.Types.ObjectId(item.productId), quantity: item.quantity, unitCost: item.unitCost })),
  });
  const allReceived = doc.items.every((line) => {
    const received = (receivedPerProduct.get(line.productId.toString()) ?? 0) + grnItems.filter((item) => item.productId === line.productId.toString()).reduce((sum, item) => sum + item.quantity, 0);
    return received >= line.quantity;
  });
  doc.status = allReceived ? "received" : "partial";
  doc.version += 1;
  await doc.save();

  await postGrnJournal(companyId, userId, doc, grnNumber, value);
  await writeAudit({ companyId, userId, action: "update", entity: "PurchaseOrder", entityId: poId, after: { poNumber: doc.poNumber, grnNumber, status: doc.status } });
  publish({ type: "purchasing.po.received", payload: { companyId, poId, grnNumber, value } });
  return { ...serializePurchaseOrder(doc), grnNumber, receivedValue: round2(value) };
}

async function postGrnJournal(companyId: string, userId: string, po: PurchaseOrderDoc, grnNumber: string, value: number) {
  const inventoryAccount = await AccountModel.findOne({ companyId, code: "1200" });
  const payableAccount = await AccountModel.findOne({ companyId, code: "2000" });
  if (!inventoryAccount || !payableAccount) return null;
  const doc = await JournalEntryModel.create({
    companyId,
    entryNumber: await nextNumber(companyId, "journal", "JE"),
    date: new Date(),
    description: `Goods receipt ${grnNumber} (${po.poNumber})`,
    reference: { type: "purchase-order", id: po._id.toString() },
    lines: [
      { accountId: inventoryAccount._id, debit: value, credit: 0, currency: "USD", fxRate: 1, description: "inventory received" },
      { accountId: payableAccount._id, debit: 0, credit: value, currency: "USD", fxRate: 1, description: "accounts payable" },
    ],
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  return { id: doc._id.toString(), entryNumber: doc.entryNumber };
}

export async function listApprovalRequests(companyId: string, query: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    ApprovalRequestModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ApprovalRequestModel.countDocuments(filter),
  ]);
  return {
    items: docs.map((doc) => ({
      id: doc._id.toString(),
      entityType: doc.entityType,
      entityId: doc.entityId.toString(),
      amount: doc.amount,
      requestedBy: doc.requestedBy.toString(),
      status: doc.status,
      decisions: doc.decisions.map((d) => ({ approverId: d.approverId.toString(), approved: d.approved, note: d.note, at: d.at.toISOString() })),
      createdAt: doc.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}