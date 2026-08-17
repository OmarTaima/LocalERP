import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { moveStock } from "./inventory.service";
import { nextNumber } from "../models/counter";
import {
  AccountModel,
  BatchModel,
  BomModel,
  InventoryModel,
  JournalEntryModel,
  MrpSuggestionModel,
  ProductModel,
  PurchaseOrderModel,
  ReorderRuleModel,
  SupplierModel,
  WarehouseModel,
  WorkCenterModel,
  WorkOrderModel,
  type BomDoc,
  type WorkCenterDoc,
  type WorkOrderDoc,
} from "../models";

export async function listBoms(tenantId: string) {
  const docs = await BomModel.find({ tenantId }).sort({ createdAt: -1 }).lean();
  return Promise.all(docs.map(async (doc) => ({ ...serializeBom(doc), productName: (await ProductModel.findById(doc.productId).lean())?.name ?? "unknown" })));
}

function serializeBom(doc: BomDoc) {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    components: doc.components.map((component) => ({ productId: component.productId.toString(), quantity: component.quantity })),
    outputQuantity: doc.outputQuantity,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createBom(tenantId: string, userId: string, input: { productId: string; components: Array<{ productId: string; quantity: number }>; outputQuantity: number }) {
  const product = await ProductModel.findOne({ _id: input.productId, tenantId });
  if (!product) throw new AppError(400, "finished-good product does not exist");
  for (const component of input.components) {
    const existing = await ProductModel.findOne({ _id: component.productId, tenantId });
    if (!existing) throw new AppError(400, `component product ${component.productId} does not exist`);
  }
  const existingBom = await BomModel.findOne({ tenantId, productId: input.productId });
  if (existingBom) throw new AppError(409, "a BOM already exists for this product");
  const doc = await BomModel.create({
    tenantId,
    productId: input.productId,
    components: input.components,
    outputQuantity: input.outputQuantity,
    version: 1,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "Bom", entityId: doc._id.toString(), after: { productId: doc.productId.toString(), components: doc.components.length } });
  return serializeBom(doc);
}

export async function updateBom(tenantId: string, userId: string, bomId: string, input: { components?: Array<{ productId: string; quantity: number }>; outputQuantity?: number }) {
  const doc = await BomModel.findOne({ _id: bomId, tenantId });
  if (!doc) throw new AppError(404, "bom not found");
  if (input.components) {
    for (const component of input.components) {
      const existing = await ProductModel.findOne({ _id: component.productId, tenantId });
      if (!existing) throw new AppError(400, `component product ${component.productId} does not exist`);
    }
    doc.components = input.components;
  }
  if (input.outputQuantity !== undefined) doc.outputQuantity = input.outputQuantity;
  doc.version += 1;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "Bom", entityId: bomId, after: { components: doc.components.length, version: doc.version } });
  return serializeBom(doc);
}

export async function deleteBom(tenantId: string, userId: string, bomId: string): Promise<void> {
  const doc = await BomModel.findOne({ _id: bomId, tenantId });
  if (!doc) throw new AppError(404, "bom not found");
  const activeOrders = await WorkOrderModel.countDocuments({ tenantId, bomId: doc._id, status: { $in: ["draft", "released", "in-progress"] } });
  if (activeOrders > 0) throw new AppError(400, "bom has active work orders");
  await writeAudit({ tenantId, userId, action: "delete", entity: "Bom", entityId: bomId, before: { productId: doc.productId.toString() } });
  await doc.deleteOne();
}

export async function listWorkCenters(tenantId: string) {
  const docs = await WorkCenterModel.find({ tenantId }).sort({ name: 1 }).lean();
  return docs.map(serializeWorkCenter);
}

function serializeWorkCenter(doc: WorkCenterDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    costPerHour: doc.costPerHour,
    capacity: doc.capacity,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createWorkCenter(tenantId: string, userId: string, input: { name: string; costPerHour: number; capacity: number }) {
  const doc = await WorkCenterModel.create({ tenantId, ...input, isActive: true });
  await writeAudit({ tenantId, userId, action: "create", entity: "WorkCenter", entityId: doc._id.toString(), after: { name: doc.name, costPerHour: doc.costPerHour } });
  return serializeWorkCenter(doc);
}

export async function updateWorkCenter(tenantId: string, userId: string, workCenterId: string, input: Record<string, unknown>) {
  const doc = await WorkCenterModel.findOne({ _id: workCenterId, tenantId });
  if (!doc) throw new AppError(404, "work center not found");
  const before = { name: doc.name, isActive: doc.isActive };
  for (const [key, value] of Object.entries(input)) {
    (doc as unknown as Record<string, unknown>)[key] = value;
  }
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "WorkCenter", entityId: workCenterId, before, after: { name: doc.name } });
  return serializeWorkCenter(doc);
}

export async function createWorkOrder(tenantId: string, userId: string, input: { bomId: string; quantity: number; workCenterId: string; plannedHours: number }) {
  const bom = await BomModel.findOne({ _id: input.bomId, tenantId });
  if (!bom) throw new AppError(404, "bom not found");
  const workCenter = await WorkCenterModel.findOne({ _id: input.workCenterId, tenantId, isActive: true });
  if (!workCenter) throw new AppError(400, "work center does not exist or is inactive");
  const doc = await WorkOrderModel.create({
    tenantId,
    woNumber: await nextNumber(tenantId, "wo", "WO"),
    bomId: bom._id,
    productId: bom.productId,
    quantity: input.quantity,
    workCenterId: workCenter._id,
    plannedHours: input.plannedHours,
    status: "draft",
    materialConsumed: [],
    finishedGoods: [],
    unitCost: 0,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "WorkOrder", entityId: doc._id.toString(), after: { woNumber: doc.woNumber, quantity: doc.quantity } });
  publish({ type: "manufacturing.wo.created", payload: { tenantId, workOrderId: doc._id.toString(), woNumber: doc.woNumber } });
  return serializeWorkOrder(doc);
}

function serializeWorkOrder(doc: WorkOrderDoc) {
  return {
    id: doc._id.toString(),
    woNumber: doc.woNumber,
    bomId: doc.bomId.toString(),
    productId: doc.productId.toString(),
    quantity: doc.quantity,
    workCenterId: doc.workCenterId.toString(),
    plannedHours: doc.plannedHours,
    status: doc.status,
    materialConsumed: doc.materialConsumed.map((item) => ({ productId: item.productId.toString(), quantity: item.quantity, batchId: item.batchId ? item.batchId.toString() : undefined })),
    finishedGoods: doc.finishedGoods.map((item) => ({ batchId: item.batchId.toString(), quantity: item.quantity })),
    unitCost: doc.unitCost,
    startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listWorkOrders(tenantId: string, query: { status?: string; productId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.status) filter.status = query.status;
  if (query.productId) filter.productId = query.productId;
  const [docs, total] = await Promise.all([
    WorkOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    WorkOrderModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeWorkOrder), total, page, pageSize };
}

export async function getWorkOrder(tenantId: string, workOrderId: string) {
  const doc = await WorkOrderModel.findOne({ _id: workOrderId, tenantId });
  if (!doc) throw new AppError(404, "work order not found");
  return serializeWorkOrder(doc);
}

export async function startWorkOrder(tenantId: string, userId: string, workOrderId: string) {
  const doc = await WorkOrderModel.findOne({ _id: workOrderId, tenantId });
  if (!doc) throw new AppError(404, "work order not found");
  if (doc.status !== "draft" && doc.status !== "released") throw new AppError(400, `work order cannot be started in ${doc.status} state`);
  const bom = await BomModel.findOne({ _id: doc.bomId, tenantId });
  if (!bom) throw new AppError(400, "bom no longer exists");
  const warehouse = await WarehouseModel.findOne({ tenantId, isDefault: true });
  if (!warehouse) throw new AppError(400, "no default warehouse for material consumption");
  const scale = doc.quantity / bom.outputQuantity;
  const consumed: Array<{ productId: string; quantity: number }> = [];
  for (const component of bom.components) {
    const needed = component.quantity * scale;
    const inventory = await InventoryModel.findOne({ tenantId, productId: component.productId, warehouseId: warehouse._id });
    if (!inventory || inventory.quantity < needed) {
      throw new AppError(400, `insufficient material stock for component ${component.productId} (need ${needed})`);
    }
    consumed.push({ productId: component.productId.toString(), quantity: needed });
  }
  for (const item of consumed) {
    await moveStock(tenantId, userId, item.productId, warehouse._id.toString(), -item.quantity, "consumed", doc._id.toString(), `work order ${doc.woNumber}`);
  }
  doc.materialConsumed = consumed;
  doc.status = "in-progress";
  doc.startedAt = new Date();
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "WorkOrder", entityId: workOrderId, after: { woNumber: doc.woNumber, status: "in-progress", materials: consumed } });
  publish({ type: "manufacturing.wo.started", payload: { tenantId, workOrderId, woNumber: doc.woNumber } });
  return serializeWorkOrder(doc);
}

export async function completeWorkOrder(tenantId: string, userId: string, workOrderId: string) {
  const doc = await WorkOrderModel.findOne({ _id: workOrderId, tenantId });
  if (!doc) throw new AppError(404, "work order not found");
  if (doc.status !== "in-progress") throw new AppError(400, `work order must be in progress before completion (currently ${doc.status})`);
  const bom = await BomModel.findOne({ _id: doc.bomId, tenantId });
  if (!bom) throw new AppError(400, "bom no longer exists");
  const workCenter = await WorkCenterModel.findOne({ _id: doc.workCenterId, tenantId });
  const warehouse = await WarehouseModel.findOne({ tenantId, isDefault: true });
  if (!warehouse) throw new AppError(400, "no default warehouse for finished goods");

  const finished = Math.round(doc.quantity / bom.outputQuantity) * bom.outputQuantity || doc.quantity;
  const batch = await BatchModel.create({
    tenantId,
    productId: doc.productId,
    lotNumber: `${doc.woNumber}-FG`,
    expiryDate: null,
    quantity: finished,
    supplierId: null,
    receivedAt: new Date(),
  });
  await moveStock(tenantId, userId, doc.productId.toString(), warehouse._id.toString(), finished, "produced", doc._id.toString(), `work order ${doc.woNumber}`, batch._id.toString());

  const consumedCost = await computeConsumedCost(tenantId, doc.materialConsumed);
  const laborCost = (workCenter?.costPerHour ?? 0) * doc.plannedHours;
  const unitCost = round2((consumedCost + laborCost) / finished);
  doc.finishedGoods = [{ batchId: batch._id.toString(), quantity: finished }];
  doc.unitCost = unitCost;
  doc.status = "completed";
  doc.completedAt = new Date();
  await doc.save();
  await postWorkOrderJournal(tenantId, userId, doc, consumedCost);
  await writeAudit({
    tenantId,
    userId,
    action: "update",
    entity: "WorkOrder",
    entityId: workOrderId,
    after: { woNumber: doc.woNumber, status: "completed", quantity: finished, unitCost },
  });
  publish({ type: "manufacturing.wo.completed", payload: { tenantId, workOrderId, woNumber: doc.woNumber, quantity: finished, unitCost } });
  return { ...serializeWorkOrder(doc), finishedQuantity: finished };
}

async function computeConsumedCost(tenantId: string, consumed: WorkOrderDoc["materialConsumed"]): Promise<number> {
  const productIds = consumed.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds }, tenantId }).lean();
  const costMap = new Map(products.map((product) => [product._id.toString(), product.cost]));
  return consumed.reduce((sum, item) => sum + item.quantity * (costMap.get(item.productId.toString()) ?? 0), 0);
}

async function postWorkOrderJournal(tenantId: string, userId: string, wo: WorkOrderDoc, consumedCost: number) {
  const inventoryAccount = await AccountModel.findOne({ tenantId, code: "1200" });
  const expenseAccount = await AccountModel.findOne({ tenantId, code: "5100" });
  const workCenter = await WorkCenterModel.findOne({ _id: wo.workCenterId, tenantId });
  const laborCost = (workCenter?.costPerHour ?? 0) * wo.plannedHours;
  if (!inventoryAccount || !expenseAccount) return null;
  const finishedValue = wo.unitCost * wo.finishedGoods.reduce((sum, item) => sum + item.quantity, 0);
  const doc = await JournalEntryModel.create({
    tenantId,
    entryNumber: await nextNumber(tenantId, "journal", "JE"),
    date: new Date(),
    description: `Work order completion ${wo.woNumber}`,
    reference: { type: "work-order", id: wo._id.toString() },
    lines: [
      { accountId: inventoryAccount._id, debit: finishedValue, credit: 0, currency: "USD", fxRate: 1, description: "finished goods" },
      { accountId: inventoryAccount._id, debit: 0, credit: consumedCost, currency: "USD", fxRate: 1, description: "raw materials consumed" },
      { accountId: expenseAccount._id, debit: 0, credit: round2(laborCost), currency: "USD", fxRate: 1, description: "labor cost" },
    ],
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  return { id: doc._id.toString(), entryNumber: doc.entryNumber };
}

export async function cancelWorkOrder(tenantId: string, userId: string, workOrderId: string) {
  const doc = await WorkOrderModel.findOne({ _id: workOrderId, tenantId });
  if (!doc) throw new AppError(404, "work order not found");
  if (doc.status !== "draft" && doc.status !== "released") throw new AppError(400, `work order cannot be cancelled in ${doc.status} state`);
  doc.status = "cancelled";
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "WorkOrder", entityId: workOrderId, after: { woNumber: doc.woNumber, status: "cancelled" } });
  return serializeWorkOrder(doc);
}

export async function generateMrpSuggestions(tenantId: string): Promise<number> {
  const rules = await ReorderRuleModel.find({ tenantId, enabled: true }).lean();
  let created = 0;
  for (const rule of rules) {
    const inventory = await InventoryModel.findOne({ tenantId, productId: rule.productId, warehouseId: rule.warehouseId }).lean();
    const current = inventory?.quantity ?? 0;
    if (current >= rule.minQuantity) continue;
    const openSuggestion = await MrpSuggestionModel.exists({ tenantId, productId: rule.productId, warehouseId: rule.warehouseId, status: "open" });
    if (openSuggestion) continue;
    const bom = await BomModel.findOne({ tenantId, productId: rule.productId }).lean();
    const type = bom ? "produce" : "purchase";
    await MrpSuggestionModel.create({
      tenantId,
      productId: rule.productId,
      warehouseId: rule.warehouseId,
      type,
      suggestedQuantity: rule.maxQuantity - current,
      reason: bom ? `BOM available; stock below reorder minimum (${current} < ${rule.minQuantity})` : `stock below reorder minimum (${current} < ${rule.minQuantity})`,
      status: "open",
    });
    created++;
  }
  if (created > 0) publish({ type: "mrp.suggestions.generated", payload: { tenantId, count: created } });
  return created;
}

export async function listMrpSuggestions(tenantId: string, query: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    MrpSuggestionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    MrpSuggestionModel.countDocuments(filter),
  ]);
  const productIds = docs.map((doc) => doc.productId);
  const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  return {
    items: docs.map((doc) => ({
      id: doc._id.toString(),
      productId: doc.productId.toString(),
      productName: productMap.get(doc.productId.toString())?.name ?? "unknown",
      sku: productMap.get(doc.productId.toString())?.sku ?? "",
      warehouseId: doc.warehouseId.toString(),
      type: doc.type,
      suggestedQuantity: doc.suggestedQuantity,
      reason: doc.reason,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function actionMrpSuggestion(tenantId: string, userId: string, suggestionId: string, status: "actioned" | "dismissed") {
  const doc = await MrpSuggestionModel.findOne({ _id: suggestionId, tenantId });
  if (!doc) throw new AppError(404, "suggestion not found");
  if (doc.status !== "open") throw new AppError(400, "suggestion already processed");
  let createdDoc: { id: string; number: string } | null = null;
  if (status === "actioned") {
    if (doc.type === "purchase") {
      const supplier = await SupplierModel.findOne({ tenantId, isActive: true }).lean();
      if (!supplier) throw new AppError(400, "no active supplier to action a purchase suggestion");
      const po = await PurchaseOrderModel.create({
        tenantId,
        poNumber: await nextNumber(tenantId, "po", "PO"),
        supplierId: supplier._id,
        items: [{ productId: doc.productId, quantity: doc.suggestedQuantity, unitCost: (await ProductModel.findById(doc.productId).lean())?.cost ?? 0 }],
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "draft",
        approvalId: null,
        grns: [],
        version: 1,
      });
      createdDoc = { id: po._id.toString(), number: po.poNumber };
    } else {
      const bom = await BomModel.findOne({ tenantId, productId: doc.productId });
      if (!bom) throw new AppError(400, "no BOM to action a produce suggestion");
      const workCenter = await WorkCenterModel.findOne({ tenantId, isActive: true }).lean();
      if (!workCenter) throw new AppError(400, "no active work center to action a produce suggestion");
      const wo = await WorkOrderModel.create({
        tenantId,
        woNumber: await nextNumber(tenantId, "wo", "WO"),
        bomId: bom._id,
        productId: doc.productId,
        quantity: doc.suggestedQuantity,
        workCenterId: workCenter._id,
        plannedHours: 1,
        status: "draft",
        materialConsumed: [],
        finishedGoods: [],
        unitCost: 0,
      });
      createdDoc = { id: wo._id.toString(), number: wo.woNumber };
    }
  }
  doc.status = status;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "MrpSuggestion", entityId: suggestionId, after: { status: doc.status } });
  return { id: doc._id.toString(), status: doc.status, type: doc.type, created: createdDoc };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}