import mongoose from "mongoose";
import type { MovementType } from "@erp/shared";
import { AppError } from "../utils/errors";
import { runInTransaction } from "../utils/transactions";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import {
  BatchModel,
  InventoryModel,
  MrpSuggestionModel,
  ProductModel,
  ReorderRuleModel,
  StockMovementModel,
  TransferModel,
  WarehouseModel,
} from "../models";

export async function listWarehouses(companyId: string) {
  const docs = await WarehouseModel.find({ companyId }).sort({ isDefault: -1, name: 1 }).lean();
  return Promise.all(
    docs.map(async (doc) => {
      const [products, lowStock] = await Promise.all([
        InventoryModel.countDocuments({ companyId, warehouseId: doc._id }),
        InventoryModel.countDocuments({ companyId, warehouseId: doc._id, quantity: { $lte: 0 } }),
      ]);
      return {
        id: doc._id.toString(),
        name: doc.name,
        address: doc.address,
        isDefault: doc.isDefault,
        isActive: doc.isActive,
        productCount: products,
        zeroStockCount: lowStock,
      };
    }),
  );
}

export async function createWarehouse(companyId: string, userId: string, input: { name: string; address?: string; isDefault?: boolean }) {
  if (input.isDefault) {
    await WarehouseModel.updateMany({ companyId }, { isDefault: false });
  }
  const doc = await WarehouseModel.create({
    companyId,
    name: input.name,
    address: input.address ?? "",
    isDefault: input.isDefault ?? false,
    isActive: true,
  });
  await writeAudit({ companyId, userId, action: "create", entity: "Warehouse", entityId: doc._id.toString(), after: { name: doc.name } });
  return { id: doc._id.toString(), name: doc.name, isDefault: doc.isDefault };
}

export async function updateWarehouse(companyId: string, userId: string, warehouseId: string, input: Partial<{ name: string; address: string; isDefault: boolean; isActive: boolean }>) {
  const doc = await WarehouseModel.findOne({ _id: warehouseId, companyId });
  if (!doc) throw new AppError(404, "warehouse not found");
  const before = { name: doc.name, address: doc.address, isDefault: doc.isDefault, isActive: doc.isActive };
  if (input.name !== undefined) doc.name = input.name;
  if (input.address !== undefined) doc.address = input.address;
  if (input.isDefault !== undefined) {
    if (input.isDefault) await WarehouseModel.updateMany({ companyId, _id: { $ne: doc._id } }, { isDefault: false });
    doc.isDefault = input.isDefault;
  }
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  await writeAudit({ companyId, userId, action: "update", entity: "Warehouse", entityId: warehouseId, before, after: { name: doc.name, address: doc.address, isDefault: doc.isDefault, isActive: doc.isActive } });
  return { id: doc._id.toString(), name: doc.name };
}

export async function deleteWarehouse(companyId: string, userId: string, warehouseId: string): Promise<void> {
  const doc = await WarehouseModel.findOne({ _id: warehouseId, companyId });
  if (!doc) throw new AppError(404, "warehouse not found");
  if (doc.isDefault) throw new AppError(400, "default warehouse cannot be deleted");
  const stock = await InventoryModel.countDocuments({ companyId, warehouseId: doc._id, quantity: { $gt: 0 } });
  if (stock > 0) throw new AppError(400, "warehouse still holds stock");
  await writeAudit({ companyId, userId, action: "delete", entity: "Warehouse", entityId: warehouseId, before: { name: doc.name } });
  await doc.deleteOne();
}

async function requireProduct(companyId: string, productId: string) {
  const product = await ProductModel.findOne({ _id: productId, companyId });
  if (!product) throw new AppError(400, "product does not exist");
  return product;
}

async function requireWarehouse(companyId: string, warehouseId: string) {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, companyId, isActive: true });
  if (!warehouse) throw new AppError(400, "warehouse does not exist or is inactive");
  return warehouse;
}

async function applyStockDelta(
  session: mongoose.ClientSession,
  companyId: string,
  userId: string,
  productId: string,
  warehouseId: string,
  delta: number,
  type: MovementType,
  referenceId: string | null,
  note: string,
  batchId: string | null = null,
): Promise<{ before: number; after: number }> {
  const inventory = await InventoryModel.findOne({ companyId, productId, warehouseId }).session(session);
  const before = inventory?.quantity ?? 0;
  const after = before + delta;
  if (after < 0) {
    throw new AppError(400, `insufficient stock: have ${before}, need ${Math.abs(delta)}`);
  }
  if (inventory) {
    inventory.quantity = after;
    inventory.version += 1;
    await inventory.save({ session });
  } else {
    if (after <= 0) throw new AppError(400, "cannot create a stock record with non-positive quantity");
    await InventoryModel.create([{ companyId, productId, warehouseId, quantity: after, version: 1 }], { session });
  }
  await StockMovementModel.create(
    [
      {
        companyId,
        productId,
        warehouseId,
        batchId,
        quantity: delta,
        type,
        referenceId,
        note,
        userId,
      },
    ],
    { session },
  );
  return { before, after };
}

export async function moveStock(
  companyId: string,
  userId: string,
  productId: string,
  warehouseId: string,
  delta: number,
  type: MovementType,
  referenceId: string | null,
  note: string,
  batchId: string | null = null,
): Promise<{ before: number; after: number }> {
  return runInTransaction((session) =>
    applyStockDelta(session, companyId, userId, productId, warehouseId, delta, type, referenceId, note, batchId),
  );
}

export type AdjustStockInput = {
  warehouseId: string;
  quantity: number;
  note?: string;
};

export async function adjustStock(companyId: string, userId: string, productId: string, input: AdjustStockInput) {
  await requireProduct(companyId, productId);
  await requireWarehouse(companyId, input.warehouseId);
  const { before, after } = await runInTransaction(async (session) => {
    const result = await applyStockDelta(
      session,
      companyId,
      userId,
      productId,
      input.warehouseId,
      input.quantity,
      "adjusted",
      null,
      input.note ?? "",
    );
    await writeAudit({
      companyId,
      userId,
      action: "update",
      entity: "Inventory",
      entityId: productId,
      before: { quantity: result.before },
      after: { quantity: result.after },
    });
    return result;
  });
  publish({ type: "stock.adjusted", payload: { companyId, productId, warehouseId: input.warehouseId, delta: input.quantity, after } });
  return { productId, warehouseId: input.warehouseId, before, after, movementType: "adjusted" };
}

export async function listMovements(companyId: string, productId: string, query: { from?: string; to?: string; page?: number; pageSize?: number }) {
  await requireProduct(companyId, productId);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId, productId };
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  const [docs, total] = await Promise.all([
    StockMovementModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    StockMovementModel.countDocuments(filter),
  ]);
  return {
    items: docs.map((doc) => ({
      id: doc._id.toString(),
      warehouseId: doc.warehouseId.toString(),
      batchId: doc.batchId ? doc.batchId.toString() : null,
      quantity: doc.quantity,
      type: doc.type,
      referenceId: doc.referenceId ? doc.referenceId.toString() : null,
      note: doc.note,
      userId: doc.userId.toString(),
      createdAt: doc.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function listLowStock(companyId: string) {
  const docs = await InventoryModel.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $match: { $expr: { $lte: ["$quantity", "$product.lowStockThreshold"] } } },
    { $sort: { quantity: 1 } },
    {
      $project: {
        productId: 1,
        warehouseId: 1,
        quantity: 1,
        sku: "$product.sku",
        name: "$product.name",
        lowStockThreshold: "$product.lowStockThreshold",
      },
    },
  ]);
  return docs.map((doc) => ({
    productId: doc.productId.toString(),
    warehouseId: doc.warehouseId.toString(),
    quantity: doc.quantity,
    sku: doc.sku,
    name: doc.name,
    lowStockThreshold: doc.lowStockThreshold,
  }));
}

export type TransferItemInput = { productId: string; quantity: number; batchId?: string };

export async function createTransfer(companyId: string, userId: string, input: { fromWarehouseId: string; toWarehouseId: string; items: TransferItemInput[] }) {
  const from = await requireWarehouse(companyId, input.fromWarehouseId);
  const to = await requireWarehouse(companyId, input.toWarehouseId);
  if (from._id.equals(to._id)) throw new AppError(400, "source and destination must differ");
  for (const item of input.items) {
    await requireProduct(companyId, item.productId);
    const inventory = await InventoryModel.findOne({ companyId, productId: item.productId, warehouseId: from._id });
    if (!inventory || inventory.quantity < item.quantity) {
      throw new AppError(400, `insufficient stock for product ${item.productId} in source warehouse`);
    }
  }
  const referenceNumber = `TRF-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  const doc = await TransferModel.create({
    companyId,
    fromWarehouseId: from._id,
    toWarehouseId: to._id,
    items: input.items,
    status: "in-transit",
    referenceNumber,
    version: 1,
  });
  await writeAudit({
    companyId,
    userId,
    action: "create",
    entity: "Transfer",
    entityId: doc._id.toString(),
    after: { referenceNumber, status: "in-transit", items: input.items },
  });
  publish({ type: "inventory.transfer.created", payload: { companyId, transferId: doc._id.toString(), referenceNumber } });
  return { id: doc._id.toString(), referenceNumber, status: "in-transit" };
}

export async function receiveTransfer(companyId: string, userId: string, transferId: string) {
  const doc = await TransferModel.findOne({ _id: transferId, companyId });
  if (!doc) throw new AppError(404, "transfer not found");
  if (doc.status === "received") throw new AppError(400, "transfer already received");
  if (doc.status === "cancelled") throw new AppError(400, "transfer was cancelled");
  await runInTransaction(async (session) => {
    for (const item of doc.items) {
      await applyStockDelta(
        session,
        companyId,
        userId,
        item.productId.toString(),
        doc.fromWarehouseId.toString(),
        -item.quantity,
        "transferred",
        doc._id.toString(),
        `transfer out ${doc.referenceNumber}`,
      );
      await applyStockDelta(
        session,
        companyId,
        userId,
        item.productId.toString(),
        doc.toWarehouseId.toString(),
        item.quantity,
        "transferred",
        doc._id.toString(),
        `transfer in ${doc.referenceNumber}`,
      );
    }
    doc.status = "received";
    doc.version += 1;
    await doc.save({ session });
  });
  publish({ type: "transfer.received", payload: { companyId, transferId, referenceNumber: doc.referenceNumber } });
  return { id: doc._id.toString(), status: doc.status };
}

export async function listTransfers(companyId: string, query: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    TransferModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    TransferModel.countDocuments(filter),
  ]);
  return {
    items: docs.map((doc) => ({
      id: doc._id.toString(),
      referenceNumber: doc.referenceNumber,
      fromWarehouseId: doc.fromWarehouseId.toString(),
      toWarehouseId: doc.toWarehouseId.toString(),
      items: doc.items.map((item) => ({ productId: item.productId.toString(), quantity: item.quantity, batchId: item.batchId ? item.batchId.toString() : undefined })),
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function listBatches(companyId: string, query: { expiringWithinDays?: number; productId?: string }) {
  const filter: Record<string, unknown> = { companyId, quantity: { $gt: 0 } };
  if (query.productId) filter.productId = query.productId;
  if (query.expiringWithinDays !== undefined) {
    const horizon = new Date(Date.now() + query.expiringWithinDays * 24 * 60 * 60 * 1000);
    filter.expiryDate = { $ne: null, $lte: horizon };
  }
  const docs = await BatchModel.find(filter).sort({ expiryDate: 1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    lotNumber: doc.lotNumber,
    expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : null,
    quantity: doc.quantity,
    supplierId: doc.supplierId ? doc.supplierId.toString() : null,
    receivedAt: doc.receivedAt.toISOString(),
  }));
}

export async function generateMrpSuggestions(companyId: string): Promise<number> {
  const rules = await ReorderRuleModel.find({ companyId, enabled: true }).lean();
  let created = 0;
  for (const rule of rules) {
    const inventory = await InventoryModel.findOne({ companyId, productId: rule.productId, warehouseId: rule.warehouseId }).lean();
    const current = inventory?.quantity ?? 0;
    if (current >= rule.minQuantity) continue;
    const suggestedQuantity = rule.maxQuantity - current;
    const openSuggestion = await MrpSuggestionModel.exists({
      companyId,
      productId: rule.productId,
      warehouseId: rule.warehouseId,
      status: "open",
    });
    if (openSuggestion) continue;
    const product = await ProductModel.findById(rule.productId).lean();
    const suggestionType = product ? "purchase" : "purchase";
    await MrpSuggestionModel.create({
      companyId,
      productId: rule.productId,
      warehouseId: rule.warehouseId,
      type: suggestionType,
      suggestedQuantity,
      reason: `stock below reorder minimum (${current} < ${rule.minQuantity})`,
      status: "open",
    });
    created++;
  }
  if (created > 0) {
    publish({ type: "mrp.suggestions.generated", payload: { companyId, count: created } });
  }
  return created;
}

export async function listMrpSuggestions(companyId: string, query: { status?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { companyId };
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

export async function actionMrpSuggestion(companyId: string, suggestionId: string, status: "actioned" | "dismissed") {
  const doc = await MrpSuggestionModel.findOne({ _id: suggestionId, companyId });
  if (!doc) throw new AppError(404, "suggestion not found");
  if (doc.status !== "open") throw new AppError(400, "suggestion already processed");
  doc.status = status;
  await doc.save();
  return { id: doc._id.toString(), status: doc.status };
}