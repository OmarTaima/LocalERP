import mongoose from "mongoose";
import { AppError } from "../utils/errors";
import { writeAudit } from "./audit.service";
import { publish } from "../events/bus";
import { nextNumber } from "../models/counter";
import { createProduct } from "./catalog.service";
import { createCustomer, createOrder as createSalesOrder } from "./sales.service";
import { createEmployee } from "./hr.service";
import {
  AccountModel,
  ApprovalRequestModel,
  AuditLogModel,
  BatchModel,
  CustomerModel,
  DepartmentModel,
  EmployeeModel,
  ExchangeRateModel,
  ExportJobModel,
  ImportJobModel,
  InventoryModel,
  JournalEntryModel,
  PaymentModel,
  ProductModel,
  SalesOrderModel,
  type ImportJobDoc,
  type ExportJobDoc,
} from "../models";

const PAID_ORDER_STATUSES = ["paid", "fulfilled", "shipped", "delivered"];

export async function dashboardStats(companyId: string, query: { from?: string; to?: string }) {
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = query.to ? new Date(query.to) : new Date();

  const [orders, products, inventory, batches, approvals] = await Promise.all([
    SalesOrderModel.find({ companyId, createdAt: { $gte: from, $lte: to } }).lean(),
    ProductModel.find({ companyId }).lean(),
    InventoryModel.find({ companyId }).lean(),
    BatchModel.find({ companyId, quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }).lean(),
    ApprovalRequestModel.countDocuments({ companyId, status: "pending" }),
  ]);

  const paidOrders = orders.filter((order) => PAID_ORDER_STATUSES.includes(order.status));
  const revenue = Math.round(paidOrders.reduce((sum, order) => sum + order.totals.total, 0) * 100) / 100;
  const ordersCount = orders.length;
  const aov = ordersCount > 0 ? Math.round((revenue / ordersCount) * 100) / 100 : 0;

  const productQuantities = new Map<string, number>();
  for (const order of paidOrders) {
    for (const item of order.items) {
      productQuantities.set(item.productId.toString(), (productQuantities.get(item.productId.toString()) ?? 0) + item.quantity);
    }
  }
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const topProducts = [...productQuantities.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId, quantity]) => ({ productId, name: productMap.get(productId)?.name ?? "unknown", sku: productMap.get(productId)?.sku ?? "", quantity }));

  const inventoryByProduct = new Map<string, number>();
  for (const row of inventory) {
    inventoryByProduct.set(row.productId.toString(), (inventoryByProduct.get(row.productId.toString()) ?? 0) + row.quantity);
  }
  const lowStock = products.filter((product) => (inventoryByProduct.get(product._id.toString()) ?? 0) < (product.lowStockThreshold ?? 0));
  const inventoryValue = Math.round(products.reduce((sum, product) => sum + product.cost * (inventoryByProduct.get(product._id.toString()) ?? 0), 0) * 100) / 100;

  const dayMap = new Map<string, number>();
  for (const order of paidOrders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + order.totals.total);
  }
  const chartSeries = [...dayMap.entries()].map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    revenue,
    orders: ordersCount,
    aov,
    topProducts,
    lowStockCount: lowStock.length,
    expiringBatches: batches.length,
    pendingApprovals: approvals,
    inventoryValue,
    chartSeries,
  };
}

export async function dashboardApprovals(companyId: string) {
  const docs = await ApprovalRequestModel.find({ companyId, status: "pending" }).sort({ createdAt: -1 }).limit(20).lean();
  return {
    items: docs.map((doc) => ({
      id: doc._id.toString(),
      entityType: doc.entityType,
      entityId: doc.entityId.toString(),
      requestedBy: doc.requestedBy.toString(),
      chain: doc.chain.map((userId) => userId.toString()),
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
    })),
    total: docs.length,
  };
}

export async function dashboardAlerts(companyId: string) {
  const [products, inventory, batches, orders, customers, payments] = await Promise.all([
    ProductModel.find({ companyId, isActive: true }).lean(),
    InventoryModel.find({ companyId }).lean(),
    BatchModel.find({ companyId, quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }).lean(),
    SalesOrderModel.find({ companyId, status: { $in: ["confirmed", "shipped"] } }).lean(),
    CustomerModel.find({ companyId }).lean(),
    PaymentModel.find({ companyId, status: "captured" }).lean(),
  ]);

  const paidByOrder = new Map<string, number>();
  for (const payment of payments) {
    paidByOrder.set(payment.orderId.toString(), (paidByOrder.get(payment.orderId.toString()) ?? 0) + payment.amount);
  }

  const inventoryByProduct = new Map<string, number>();
  for (const row of inventory) {
    inventoryByProduct.set(row.productId.toString(), (inventoryByProduct.get(row.productId.toString()) ?? 0) + row.quantity);
  }
  const lowStock = products
    .filter((product) => (inventoryByProduct.get(product._id.toString()) ?? 0) < (product.lowStockThreshold ?? 0))
    .map((product) => ({ productId: product._id.toString(), sku: product.sku, name: product.name, quantity: inventoryByProduct.get(product._id.toString()) ?? 0, threshold: product.lowStockThreshold ?? 0 }));

  const expiringBatches = batches.map((batch) => ({
    batchId: batch._id.toString(),
    lotNumber: batch.lotNumber,
    productId: batch.productId.toString(),
    expiryDate: batch.expiryDate ? batch.expiryDate.toISOString() : null,
    quantity: batch.quantity,
  }));

  const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer.name]));
  const overdue = orders
    .filter((order) => order.totals.total > (paidByOrder.get(order._id.toString()) ?? 0))
    .map((order) => ({
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerId: order.customerId.toString(),
      customerName: customerMap.get(order.customerId.toString()) ?? "unknown",
      total: order.totals.total,
      paid: paidByOrder.get(order._id.toString()) ?? 0,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    }));

  return { lowStock, expiringBatches, overdueInvoices: overdue };
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

async function processImport(companyId: string, userId: string, type: ImportJobDoc["type"], rows: string[][], errors: string[]) {
  let processed = 0;
  const header = rows[0].map((cell) => cell.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const at = (name: string) => row[col(name)]?.trim() ?? "";
    try {
      if (type === "products") {
        await createProduct(companyId, userId, {
          sku: at("sku"),
          name: at("name"),
          price: Number(at("price")),
          cost: Number(at("cost") ?? "0"),
          isActive: true,
        });
      } else if (type === "customers") {
        await createCustomer(companyId, userId, { name: at("name"), email: at("email"), phone: at("phone"), address: { label: at("label"), street: at("street"), city: at("city"), country: at("country") } });
      } else if (type === "employees") {
        const department = await DepartmentModel.findOne({ companyId, name: { $regex: `^${at("department")}$`, $options: "i" } }).lean();
        if (!department) throw new Error(`department "${at("department")}" not found`);
        await createEmployee(companyId, userId, {
          name: at("name"),
          email: at("email"),
          position: at("position"),
          salary: Number(at("salary")),
          hireDate: at("hiredate") || new Date().toISOString().slice(0, 10),
          departmentId: department._id.toString(),
        });
      } else if (type === "orders") {
        const customer = await CustomerModel.findOne({ companyId, email: at("customeremail") }).lean();
        if (!customer) throw new Error(`customer "${at("customeremail")}" not found`);
        const items = at("items")
          .split(";")
          .filter((part) => part.includes(":"))
          .map((part) => {
            const [sku, quantity] = part.split(":");
            return { sku, quantity: Number(quantity) };
          });
        if (items.length === 0) throw new Error("no items in order row");
        const resolved = [];
        for (const item of items) {
          const product = await ProductModel.findOne({ companyId, sku: item.sku }).lean();
          if (!product) throw new Error(`product "${item.sku}" not found`);
          resolved.push({ productId: product._id.toString(), quantity: item.quantity });
        }
        await createSalesOrder(companyId, userId, {
          customerId: customer._id.toString(),
          items: resolved,
          shippingAddress: { label: "import", street: "import", city: "import", country: "import" },
          idempotencyKey: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      processed++;
    } catch (err) {
      errors.push(`row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return processed;
}

export async function queueImportJob(companyId: string, userId: string, input: { type: ImportJobDoc["type"]; data: string }) {
  const job = await ImportJobModel.create({
    companyId,
    type: input.type,
    fileUrl: `inline://${input.type}`,
    status: "queued",
    result: { processed: 0, failed: 0, errors: [] },
    createdBy: new mongoose.Types.ObjectId(userId),
  });
  job.status = "processing";
  await job.save();
  const errors: string[] = [];
  let processed = 0;
  try {
    const rows = parseCsv(input.data);
    if (rows.length < 2) throw new AppError(400, "import file must contain a header row and at least one data row");
    processed = await processImport(companyId, userId, input.type, rows, errors);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  job.status = errors.length === 0 && processed > 0 ? "done" : errors.length > 0 && processed === 0 ? "failed" : "done";
  job.result = { processed, failed: errors.length, errors };
  await job.save();
  await writeAudit({ companyId, userId, action: "create", entity: "ImportJob", entityId: job._id.toString(), after: { type: input.type, processed, failed: errors.length } });
  publish({ type: "import.completed", payload: { companyId, jobId: job._id.toString(), result: job.result } });
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    result: { processed, failed: errors.length, errors },
  };
}

export async function getImportJob(companyId: string, jobId: string) {
  const job = await ImportJobModel.findOne({ _id: jobId, companyId }).lean();
  if (!job) throw new AppError(404, "import job not found");
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    result: job.result,
    createdAt: job.createdAt.toISOString(),
  };
}

export async function queueExportJob(companyId: string, userId: string, input: { type: ExportJobDoc["type"]; from?: string; to?: string }) {
  const job = await ExportJobModel.create({
    companyId,
    type: input.type,
    status: "processing",
    fileUrl: null,
    fileContent: "",
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  let rows: string[][] = [];
  if (input.type === "products") {
    const docs = await ProductModel.find({ companyId }).sort({ sku: 1 }).lean();
    rows = [["id", "sku", "name", "price", "cost", "isActive"], ...docs.map((doc) => [doc._id.toString(), doc.sku, doc.name, String(doc.price), String(doc.cost), String(doc.isActive)])];
  } else if (input.type === "customers") {
    const docs = await CustomerModel.find({ companyId }).sort({ name: 1 }).lean();
    rows = [["id", "name", "email", "phone"], ...docs.map((doc) => [doc._id.toString(), doc.name, doc.email, doc.phone])];
  } else if (input.type === "orders") {
    const filter: Record<string, unknown> = { companyId };
    if (input.from || input.to) {
      filter.createdAt = {
        ...(input.from ? { $gte: new Date(input.from) } : {}),
        ...(input.to ? { $lte: new Date(input.to) } : {}),
      };
    }
    const docs = await SalesOrderModel.find(filter).sort({ createdAt: -1 }).lean();
    rows = [["id", "orderNumber", "customerId", "total", "status"], ...docs.map((doc) => [doc._id.toString(), doc.orderNumber, doc.customerId.toString(), String(doc.totals.total), doc.status])];
  } else {
    const docs = await EmployeeModel.find({ companyId }).sort({ name: 1 }).lean();
    rows = [["id", "name", "email", "position", "status"], ...docs.map((doc) => [doc._id.toString(), doc.name, doc.email, doc.position, doc.status])];
  }

  job.fileContent = rows.map((row) => row.join(",")).join("\n");
  job.status = "done";
  job.fileUrl = `erp-export://${input.type}-${job._id.toString()}.csv`;
  await job.save();
  await writeAudit({ companyId, userId, action: "export", entity: "ExportJob", entityId: job._id.toString(), after: { type: input.type, rows: rows.length } });
  publish({ type: "export.completed", payload: { companyId, jobId: job._id.toString(), url: job.fileUrl } });
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    fileUrl: job.fileUrl,
    createdAt: job.createdAt.toISOString(),
  };
}

export async function getExportJob(companyId: string, jobId: string) {
  const job = await ExportJobModel.findOne({ _id: jobId, companyId }).lean();
  if (!job) throw new AppError(404, "export job not found");
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    fileUrl: job.fileUrl,
    content: job.fileContent,
    createdAt: job.createdAt.toISOString(),
  };
}

export async function exportAuditLogs(companyId: string, query: { from?: string; to?: string }) {
  const filter: Record<string, unknown> = { companyId };
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  const docs = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(10000).lean();
  const rows = [["id", "userId", "action", "entity", "entityId", "ip", "createdAt"], ...docs.map((doc) => [doc._id.toString(), doc.userId.toString(), doc.action, doc.entity, doc.entityId.toString(), doc.ip, doc.createdAt.toISOString()])];
  return { csv: rows.map((row) => row.join(",")).join("\n"), count: docs.length };
}

export async function fxRevaluation(companyId: string, userId: string) {
  const [rates, accounts, journalDocs] = await Promise.all([
    ExchangeRateModel.find({ companyId, toCurrency: "USD" }).lean(),
    AccountModel.find({ companyId }).lean(),
    JournalEntryModel.find({ companyId, status: "posted" }).lean(),
  ]);
  if (rates.length === 0) throw new AppError(400, "no exchange rates configured for revaluation");
  const rateMap = new Map(rates.map((rate) => [rate.fromCurrency, rate.rate]));

  const positions = new Map<string, { accountId: string; booked: number; current: number }>();
  for (const entry of journalDocs) {
    for (const line of entry.lines) {
      const key = `${line.accountId.toString()}:${line.currency}`;
      const position = positions.get(key) ?? { accountId: line.accountId.toString(), booked: 0, current: 0 };
      const balance = line.debit - line.credit;
      position.booked += balance * (line.fxRate ?? 1);
      position.current += balance * (rateMap.get(line.currency) ?? line.fxRate ?? 1);
      positions.set(key, position);
    }
  }

  const lines: Array<{ accountId: mongoose.Types.ObjectId; debit: number; credit: number; currency: string; fxRate: number; description: string }> = [];
  for (const position of positions.values()) {
    const gain = Math.round((position.current - position.booked) * 100) / 100;
    if (Math.abs(gain) < 0.01) continue;
    const account = accounts.find((candidate) => candidate._id.toString() === position.accountId);
    if (!account) continue;
    if (gain > 0) {
      lines.push({ accountId: account._id, debit: gain, credit: 0, currency: "USD", fxRate: 1, description: "unrealized FX gain" });
    } else {
      lines.push({ accountId: account._id, debit: 0, credit: -gain, currency: "USD", fxRate: 1, description: "unrealized FX loss" });
    }
  }
  if (lines.length === 0) return { entryNumber: null, lines: 0 };

  const totalGain = Math.round(lines.reduce((sum, line) => sum + line.debit - line.credit, 0) * 100) / 100;
  const gainAccount = await AccountModel.findOne({ companyId, code: "4900" });
  const lossAccount = await AccountModel.findOne({ companyId, code: "4901" });
  if (!gainAccount || !lossAccount) throw new AppError(400, "FX gain/loss accounts (4900/4901) are not set up");
  if (totalGain >= 0) {
    lines.push({ accountId: gainAccount._id, debit: 0, credit: totalGain, currency: "USD", fxRate: 1, description: "unrealized FX gain offset" });
  } else {
    lines.push({ accountId: lossAccount._id, debit: -totalGain, credit: 0, currency: "USD", fxRate: 1, description: "unrealized FX loss offset" });
  }

  const entry = await JournalEntryModel.create({
    companyId,
    entryNumber: await nextNumber(companyId, "journal", "JE"),
    date: new Date(),
    description: "Period-end FX revaluation",
    reference: { type: "fx-revaluation", id: "fx-revaluation" },
    lines,
    status: "posted",
    reversedById: null,
    createdBy: userId,
  });
  await writeAudit({ companyId, userId, action: "create", entity: "JournalEntry", entityId: entry._id.toString(), after: { entryNumber: entry.entryNumber, description: "Period-end FX revaluation" } });
  return { entryNumber: entry.entryNumber, lines: lines.length };
}