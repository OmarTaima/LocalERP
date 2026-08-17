import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { ROLE_PRESETS } from "../constants/permissions";
import { BatchModel, RoleModel, CompanyModel, UserModel } from "../models";
import { createNotification } from "../services/notification.service";
import { writeAudit } from "../services/audit.service";
import { createCategory, createProduct } from "../services/catalog.service";
import { createWarehouse, adjustStock } from "../services/inventory.service";
import {
  createCustomer,
  createOrder,
  createPayment,
  createQuote,
  createRecurringInvoice,
  createShipment,
  updateOrderStatus,
  updateQuote,
  updateShipmentStatus,
} from "../services/sales.service";
import { createSupplier, createPurchaseOrder, approvePurchaseOrder, receivePurchaseOrder } from "../services/purchasing.service";
import { createBom, createWorkCenter, createWorkOrder, startWorkOrder, completeWorkOrder, generateMrpSuggestions, actionMrpSuggestion, listMrpSuggestions } from "../services/manufacturing.service";
import { seedDefaultAccounts } from "../models/account";
import { createJournalEntry, createExpense, createExpenseClaim, updateExpenseClaimStatus, upsertExchangeRate, listAccounts } from "../services/finance.service";
import {
  createDepartment,
  createEmployee,
  bulkMarkAttendance,
  submitTimesheet,
  approveTimesheet,
  requestLeave,
  updateLeaveStatus,
  createShiftPattern,
  generatePayrollRun,
  payPayrollRun,
} from "../services/hr.service";

const COMPANY_SLUG = "acme-demo";
const PASSWORD = "demo1234";
const ADMIN_EMAIL = "omar@admin.com";
const ADMIN_PASSWORD = "2224401omart";
const DEMO_EMAIL = "demo@gmail.com";

const COMPANY_SCOPED_MODELS = [
  "Attendance", "AuditLog", "Batch", "Bom", "Category", "Counter",
  "Customer", "Department", "Employee", "ExchangeRate", "ExpenseClaim",
  "Expense", "Inventory", "JournalEntry", "LeaveRequest", "MrpSuggestion",
  "Notification", "PayrollRun", "Payment", "Product", "PurchaseOrder",
  "Quote", "RecurringInvoice", "Rma", "Role", "SalesOrder", "Session",
  "Shipment", "ShiftPattern", "StockMovement", "Supplier", "Timesheet",
  "Transfer", "TwoFactor", "User", "Warehouse", "WorkCenter", "WorkOrder",
] as const;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoDaysAgo(n: number): string {
  return daysAgo(n).toISOString().slice(0, 10);
}

async function wipeDemoCompany(): Promise<void> {
  const company = await CompanyModel.findOne({ slug: COMPANY_SLUG });
  if (!company) return;
  for (const name of COMPANY_SCOPED_MODELS) {
    const model = mongoose.models[name] as mongoose.Model<{ companyId?: unknown }> | undefined;
    if (!model) continue;
    await model.deleteMany({ companyId: company._id });
  }
  await CompanyModel.deleteOne({ _id: company._id });
  console.log(`[seed] wiped previous ${COMPANY_SLUG} company`);
}

async function run(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log("[seed] connected");
  await wipeDemoCompany();

  const company = await CompanyModel.create({
    name: "Acme Demo Co",
    slug: COMPANY_SLUG,
    plan: "enterprise",
    isActive: true,
    settings: { currency: "USD", taxRate: 0, timezone: "UTC" },
    limits: { maxUsers: 500, maxProducts: 50000, features: ["manufacturing", "api-keys", "multi-currency"] },
  });
  const companyId = company._id.toString();
  console.log("[seed] company created");

  for (const [name, permissions] of Object.entries(ROLE_PRESETS)) {
    await RoleModel.create({ companyId: company._id, name, permissions, isSystem: true });
  }
  const roles = await RoleModel.find({ companyId: company._id }).lean();
  const roleId = (name: string) => roles.find((r) => r.name === name)!._id.toString();
  console.log("[seed] roles:", roles.map((r) => r.name).join(", "));

  const userData: Array<{ email: string; name: string; role: string; password: string }> = [
    { email: ADMIN_EMAIL, name: "Omar Admin", role: "admin", password: ADMIN_PASSWORD },
    { email: DEMO_EMAIL, name: "Demo Manager", role: "user", password: PASSWORD },
    { email: "accountant@acme.demo", name: "Lina Finance", role: "user", password: PASSWORD },
    { email: "support@acme.demo", name: "Sam Support", role: "user", password: PASSWORD },
    { email: "employee@acme.demo", name: "Nour Employee", role: "user", password: PASSWORD },
  ];
  const users: Record<string, string> = {};
  for (const u of userData) {
    const doc = await UserModel.create({
      companyId: company._id,
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 12),
      name: u.name,
      roleId: new mongoose.Types.ObjectId(roleId(u.role)),
      isActive: true,
      lastLoginAt: new Date(),
      mustChangePassword: false,
      avatarUrl: null,
    });
    users[u.email] = doc._id.toString();
  }
  console.log("[seed] users: " + ADMIN_EMAIL + " (admin), " + DEMO_EMAIL + " + 3 others (user)");

  await seedDefaultAccounts(companyId);
  console.log("[seed] chart of accounts seeded");

  const mainWarehouse = await createWarehouse(companyId, users[ADMIN_EMAIL], { name: "Main Warehouse", address: "1 Industrial Park, Newark NJ", isDefault: true });
  const eastWarehouse = await createWarehouse(companyId, users[ADMIN_EMAIL], { name: "East Distribution Center", address: "15 Harbor Blvd, Boston MA" });
  const mainId = mainWarehouse.id;
  const eastId = eastWarehouse.id;
  console.log("[seed] warehouses:", mainWarehouse.name, "+", eastWarehouse.name);

  const categories: string[] = [];
  for (const name of ["Electronics", "Accessories", "Office Furniture", "Packaging", "Raw Materials"]) {
    const cat = await createCategory(companyId, users[ADMIN_EMAIL], { name });
    categories.push(cat.id);
  }

  const products: Array<{ sku: string; name: string; price: number; cost: number; category: number; threshold?: number; main: number; east?: number }> = [
    { sku: "EL-KB80", name: "Ergo Keyboard K80", price: 89, cost: 42, category: 0, threshold: 10, main: 120, east: 60 },
    { sku: "EL-MS1", name: "Wireless Mouse M1", price: 39, cost: 18, category: 0, threshold: 20, main: 200, east: 100 },
    { sku: "EL-MN27", name: '27" 4K Monitor', price: 329, cost: 210, category: 0, threshold: 5, main: 45, east: 20 },
    { sku: "EL-HUB8", name: "USB-C Hub 8-in-1", price: 49, cost: 26, category: 0, threshold: 15, main: 80 },
    { sku: "EL-HD2", name: "Noise-Cancel Headset H2", price: 199, cost: 120, category: 0, threshold: 8, main: 55, east: 30 },
    { sku: "EL-WB3", name: "1080p Webcam W3", price: 59, cost: 31, category: 0, threshold: 12, main: 70 },
    { sku: "AC-STND", name: "Aluminum Laptop Stand", price: 45, cost: 22, category: 1, threshold: 15, main: 90, east: 40 },
    { sku: "AC-DSKM", name: "Desk Mat XL", price: 25, cost: 11, category: 1, threshold: 20, main: 140 },
    { sku: "AC-CBLK", name: "Cable Kit Pro", price: 19, cost: 8, category: 1, threshold: 20, main: 5 },
    { sku: "OF-DSKP", name: "Standing Desk Pro", price: 549, cost: 330, category: 2, threshold: 4, main: 25, east: 10 },
    { sku: "OF-CHR2", name: "Ergonomic Chair E2", price: 399, cost: 240, category: 2, threshold: 5, main: 30, east: 15 },
    { sku: "OF-MNA2", name: "Monitor Arm Dual", price: 99, cost: 55, category: 2, threshold: 8, main: 40 },
    { sku: "PK-BOX", name: "Cardboard Box 40x30x30", price: 1.2, cost: 0.5, category: 3, threshold: 200, main: 800, east: 300 },
    { sku: "PK-BWR", name: "Bubble Wrap Roll", price: 8, cost: 3, category: 3, threshold: 10, main: 8 },
    { sku: "RM-ALP", name: "Aluminum Profile 1m", price: 6, cost: 2.5, category: 4, threshold: 100, main: 400 },
    { sku: "RM-SCR", name: "Steel Screw Pack", price: 4, cost: 1.2, category: 4, threshold: 30, main: 12 },
  ];
  const productIds: string[] = [];
  for (const p of products) {
    const doc = await createProduct(companyId, users[ADMIN_EMAIL], {
      sku: p.sku,
      name: p.name,
      price: p.price,
      cost: p.cost,
      categoryId: categories[p.category],
      lowStockThreshold: p.threshold ?? 5,
      description: `Demo product ${p.name}`,
    });
    productIds.push(doc.id);
    await adjustStock(companyId, users[ADMIN_EMAIL], doc.id, { warehouseId: mainId, quantity: p.main, note: "seed initial stock" });
    if (p.east) {
      await adjustStock(companyId, users[ADMIN_EMAIL], doc.id, { warehouseId: eastId, quantity: p.east, note: "seed east stock" });
    }
  }
  console.log(`[seed] ${products.length} products + stock seeded`);

  await BatchModel.create([
    { companyId: company._id, lotNumber: "RM-ALP-2601", productId: productIds[14], quantity: 400, expiryDate: daysAgo(-365), supplierId: null, receivedAt: new Date() },
    { companyId: company._id, lotNumber: "PK-BWR-2602", productId: productIds[13], quantity: 30, expiryDate: daysAgo(-120), supplierId: null, receivedAt: new Date() },
  ]);

  const customers: Array<{ name: string; email: string; phone: string; creditLimit: number; addresses: Array<{ label: string; street: string; city: string; country: string }> }> = [
    { name: "Acme Retail Ltd", email: "orders@acme-retail.com", phone: "+1-555-0101", creditLimit: 50000, addresses: [{ label: "HQ", street: "1 Market St", city: "San Francisco", country: "USA" }] },
    { name: "Globex Stores", email: "buy@globex.co", phone: "+1-555-0102", creditLimit: 30000, addresses: [{ label: "Main", street: "88 Broadway", city: "New York", country: "USA" }] },
    { name: "Initech Inc", email: "procurement@initech.io", phone: "+1-555-0103", creditLimit: 20000, addresses: [{ label: "Office", street: "400 Tech Park Dr", city: "Austin", country: "USA" }] },
    { name: "Umbrella Logistics", email: "ops@umbrella-logistics.com", phone: "+1-555-0104", creditLimit: 40000, addresses: [{ label: "Depot", street: "7 Cargo Way", city: "Chicago", country: "USA" }] },
    { name: "Stark Industrial", email: "purchasing@starkind.com", phone: "+1-555-0105", creditLimit: 60000, addresses: [{ label: "Plant", street: "120 Forge Ave", city: "Detroit", country: "USA" }] },
    { name: "Wayne Traders", email: "orders@waynetraders.net", phone: "+1-555-0106", creditLimit: 15000, addresses: [{ label: "Main", street: "22 Commerce Rd", city: "Seattle", country: "USA" }] },
    { name: "Pied Piper", email: "ops@piedpiper.app", phone: "+1-555-0107", creditLimit: 25000, addresses: [{ label: "HQ", street: "9 Compression St", city: "Palo Alto", country: "USA" }] },
    { name: "Hooli Corp", email: "supply@hooli.com", phone: "+1-555-0108", creditLimit: 50000, addresses: [{ label: "Campus", street: "500 Hooli Way", city: "San Jose", country: "USA" }] },
  ];
  const customerIds: string[] = [];
  for (const c of customers) {
    const doc = await createCustomer(companyId, users[ADMIN_EMAIL], { ...c, tags: [], notes: "" });
    customerIds.push(doc.id);
  }
  console.log(`[seed] ${customers.length} customers`);

  const orderItem = (idx: number, qty: number) => ({ productId: productIds[idx], quantity: qty });
  const shipAddress = (label: string) => ({ label, street: "1 Market St", city: "San Francisco", country: "USA" });
  let orderCount = 0;
  const advanceToPaid = async (order: { id: string; totals: { total: number } }, method: "card" | "transfer" | "cash", key: string) => {
    await updateOrderStatus(companyId, users[ADMIN_EMAIL], order.id, "confirmed");
    await createPayment(companyId, users[ADMIN_EMAIL], order.id, {
      amount: order.totals.total,
      method,
      reference: `PAY-${key}`,
      idempotencyKey: `seed-pay-${key}`,
    });
  };

  for (let i = 0; i < 2; i++) {
    await createOrder(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 2) % customers.length],
      items: [orderItem(i % productIds.length, 2)],
      shippingAddress: shipAddress("Main"),
      idempotencyKey: `seed-order-draft-${i}`,
    });
    orderCount++;
  }
  for (let i = 0; i < 3; i++) {
    const order = await createOrder(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 3 + 1) % customers.length],
      items: [orderItem((i * 2 + 2) % productIds.length, 2), orderItem((i * 3 + 4) % productIds.length, 1)],
      shippingAddress: shipAddress("Office"),
      idempotencyKey: `seed-order-confirmed-${i}`,
    });
    await updateOrderStatus(companyId, users[ADMIN_EMAIL], order.id, "confirmed");
    orderCount++;
  }
  for (let i = 0; i < 4; i++) {
    const order = await createOrder(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 4 + 2) % customers.length],
      items: [orderItem((i * 2 + 5) % productIds.length, 3), orderItem((i * 2 + 3) % productIds.length, 2)],
      shippingAddress: shipAddress("Depot"),
      idempotencyKey: `seed-order-paid-${i}`,
    });
    await advanceToPaid(order, ["card", "transfer", "cash", "card"][i] as "card" | "transfer" | "cash", `p${i}`);
    orderCount++;
  }
  for (let i = 0; i < 3; i++) {
    const order = await createOrder(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 3 + 3) % customers.length],
      items: [orderItem((i * 3 + 6) % productIds.length, 2), orderItem((i * 2 + 7) % productIds.length, 1)],
      shippingAddress: shipAddress("Plant"),
      idempotencyKey: `seed-order-shipped-${i}`,
    });
    await advanceToPaid(order, "transfer", `s${i}`);
    const shipment = await createShipment(companyId, users[ADMIN_EMAIL], {
      orderId: order.id,
      carrier: ["DHL", "FedEx", "UPS"][i],
      trackingNumber: `TRK${i}${Date.now().toString().slice(-6)}`,
      pickList: order.items.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity, fromWarehouseId: mainId })),
    });
    await updateShipmentStatus(companyId, users[ADMIN_EMAIL], shipment.id, { status: "packed" });
    await updateShipmentStatus(companyId, users[ADMIN_EMAIL], shipment.id, { status: "shipped", trackingNumber: shipment.trackingNumber });
    orderCount++;
  }
  for (let i = 0; i < 2; i++) {
    const order = await createOrder(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 5 + 4) % customers.length],
      items: [orderItem((i * 2 + 9) % productIds.length, 2), orderItem((i * 3 + 10) % productIds.length, 1)],
      shippingAddress: shipAddress("HQ"),
      idempotencyKey: `seed-order-delivered-${i}`,
    });
    await advanceToPaid(order, "card", `d${i}`);
    const shipment = await createShipment(companyId, users[ADMIN_EMAIL], {
      orderId: order.id,
      carrier: ["DHL", "UPS"][i],
      trackingNumber: `TRKD${i}${Date.now().toString().slice(-6)}`,
      pickList: order.items.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: item.quantity, fromWarehouseId: mainId })),
    });
    await updateShipmentStatus(companyId, users[ADMIN_EMAIL], shipment.id, { status: "packed" });
    await updateShipmentStatus(companyId, users[ADMIN_EMAIL], shipment.id, { status: "shipped", trackingNumber: shipment.trackingNumber });
    await updateShipmentStatus(companyId, users[ADMIN_EMAIL], shipment.id, { status: "delivered" });
    orderCount++;
  }
  console.log(`[seed] ${orderCount} orders across all statuses`);

  for (let i = 0; i < 2; i++) {
    const quote = await createQuote(companyId, users[ADMIN_EMAIL], {
      customerId: customerIds[(i * 3 + 5) % customers.length],
      items: [orderItem(i * 2 + 1, 2), orderItem(i * 2 + 8, 2)],
      validUntil: isoDaysAgo(-10),
    });
    await updateQuote(companyId, users[ADMIN_EMAIL], quote.id, { status: "sent" });
  }
  await createQuote(companyId, users[ADMIN_EMAIL], { customerId: customerIds[2], items: [orderItem(4, 2), orderItem(11, 2)], validUntil: isoDaysAgo(-20) });
  const declined = await createQuote(companyId, users[ADMIN_EMAIL], { customerId: customerIds[5], items: [orderItem(3, 2)], validUntil: isoDaysAgo(-5) });
  await updateQuote(companyId, users[ADMIN_EMAIL], declined.id, { status: "declined" });
  console.log("[seed] 4 quotes");

  await createRecurringInvoice(companyId, users[ADMIN_EMAIL], {
    customerId: customerIds[0],
    items: [{ name: "Office furniture maintenance", quantity: 1, unitPrice: 500 }],
    interval: "monthly",
    dayOfPeriod: 1,
  });
  await createRecurringInvoice(companyId, users[ADMIN_EMAIL], {
    customerId: customerIds[7],
    items: [{ productId: productIds[4], name: "Noise-Cancel Headset H2", quantity: 10, unitPrice: 199 }],
    interval: "quarterly",
    dayOfPeriod: 15,
  });
  console.log("[seed] 2 recurring invoices");

  const suppliers: Array<{ name: string; contactName: string; email: string; phone: string; address: string; paymentTerms: string }> = [
    { name: "Northwind Components", contactName: "Alice Chen", email: "sales@northwind-parts.com", phone: "+1-555-0201", address: "12 Industrial Pkwy, Cleveland OH", paymentTerms: "Net 30" },
    { name: "Sunrise Materials Co", contactName: "Ben Ortiz", email: "info@sunrisematerials.com", phone: "+1-555-0202", address: "34 Foundry St, Pittsburgh PA", paymentTerms: "Net 45" },
    { name: "Global Packaging Group", contactName: "Carla Mendes", email: "orders@gpg-pack.com", phone: "+1-555-0203", address: "9 Box Lane, Memphis TN", paymentTerms: "Net 15" },
    { name: "Ironworks Metal Supply", contactName: "David Kim", email: "sales@ironworks-steel.com", phone: "+1-555-0204", address: "77 Furnace Rd, Gary IN", paymentTerms: "Net 60" },
    { name: "Tech Parts Import", contactName: "Elena Rossi", email: "import@techparts.eu", phone: "+39-02-555-0205", address: "Via Europa 21, Milan, Italy", paymentTerms: "Net 30" },
  ];
  const supplierIds: string[] = [];
  for (const s of suppliers) {
    const doc = await createSupplier(companyId, users[ADMIN_EMAIL], { ...s, isActive: true });
    supplierIds.push(doc.id);
  }
  console.log(`[seed] ${suppliers.length} suppliers`);

  const poItem = (idx: number, qty: number, cost: number) => ({ productId: productIds[idx], quantity: qty, unitCost: cost });
  const po1 = await createPurchaseOrder(companyId, users[ADMIN_EMAIL], {
    supplierId: supplierIds[0],
    items: [poItem(12, 2500, 0.5), poItem(13, 40, 3)],
    expectedDate: isoDaysAgo(-14),
  });
  await approvePurchaseOrder(companyId, users[ADMIN_EMAIL], po1.id, { approved: true });
  const po2 = await createPurchaseOrder(companyId, users[ADMIN_EMAIL], {
    supplierId: supplierIds[2],
    items: [poItem(12, 3500, 0.5), poItem(13, 50, 3)],
    expectedDate: isoDaysAgo(-10),
  });
  await approvePurchaseOrder(companyId, users[ADMIN_EMAIL], po2.id, { approved: true });
  const smallSent = await createPurchaseOrder(companyId, users[ADMIN_EMAIL], {
    supplierId: supplierIds[2],
    items: [poItem(12, 50, 0.5)],
    expectedDate: isoDaysAgo(21),
  });
  const largePending = await createPurchaseOrder(companyId, users[ADMIN_EMAIL], {
    supplierId: supplierIds[4],
    items: [poItem(9, 30, 250), poItem(8, 100, 12)],
    expectedDate: isoDaysAgo(10),
  });
  const approved = await createPurchaseOrder(companyId, users[ADMIN_EMAIL], {
    supplierId: supplierIds[3],
    items: [poItem(14, 400, 2), poItem(15, 600, 0.8)],
    expectedDate: isoDaysAgo(-7),
  });
  await approvePurchaseOrder(companyId, users[ADMIN_EMAIL], approved.id, { approved: true });
  await receivePurchaseOrder(companyId, users[ADMIN_EMAIL], approved.id);
  console.log(`[seed] 6 POs (sent=${smallSent.id}, pendingApproval=${largePending.id}, received=${approved.id})`);

  const workCenters: string[] = [];
  for (const [name, costPerHour, capacity] of [["Assembly Line A", 45, 100], ["CNC Station", 60, 50], ["Finishing Bench", 30, 80]] as const) {
    const wc = await createWorkCenter(companyId, users[ADMIN_EMAIL], { name, costPerHour, capacity });
    workCenters.push(wc.id);
  }
  const boms: string[] = [];
  for (const [productIdx, components, outputQuantity] of [
    [9, [[14, 4], [15, 16], [12, 1]], 1],
    [11, [[14, 2], [15, 8], [12, 1]], 1],
    [0, [[15, 6], [12, 1]], 1],
    [10, [[14, 3], [15, 20], [12, 1]], 1],
  ] as const) {
    const bom = await createBom(companyId, users[ADMIN_EMAIL], {
      productId: productIds[productIdx],
      components: components.map(([idx, qty]) => ({ productId: productIds[idx], quantity: qty })),
      outputQuantity,
    });
    boms.push(bom.id);
  }
  console.log("[seed] 3 work centers + 4 BOMs");

  await createWorkOrder(companyId, users[ADMIN_EMAIL], { bomId: boms[0], quantity: 20, workCenterId: workCenters[0], plannedHours: 30 });
  await createWorkOrder(companyId, users[ADMIN_EMAIL], { bomId: boms[2], quantity: 30, workCenterId: workCenters[2], plannedHours: 12 });
  const wo2 = await createWorkOrder(companyId, users[ADMIN_EMAIL], { bomId: boms[0], quantity: 10, workCenterId: workCenters[0], plannedHours: 16 });
  await startWorkOrder(companyId, users[ADMIN_EMAIL], wo2.id);
  const wo4 = await createWorkOrder(companyId, users[ADMIN_EMAIL], { bomId: boms[3], quantity: 5, workCenterId: workCenters[1], plannedHours: 20 });
  await startWorkOrder(companyId, users[ADMIN_EMAIL], wo4.id);
  await completeWorkOrder(companyId, users[ADMIN_EMAIL], wo4.id);
  const wo5 = await createWorkOrder(companyId, users[ADMIN_EMAIL], { bomId: boms[1], quantity: 8, workCenterId: workCenters[1], plannedHours: 10 });
  await startWorkOrder(companyId, users[ADMIN_EMAIL], wo5.id);
  console.log("[seed] work orders: released x2, in-progress x2, completed x1");

  const mrpCount = await generateMrpSuggestions(companyId);
  const suggestions = await listMrpSuggestions(companyId, { pageSize: 100 });
  const open = suggestions.items.filter((s: { status: string }) => s.status === "open");
  if (open.length >= 2) {
    await actionMrpSuggestion(companyId, users[ADMIN_EMAIL], open[0].id, "actioned");
    await actionMrpSuggestion(companyId, users[ADMIN_EMAIL], open[1].id, "dismissed");
  }
  console.log(`[seed] MRP suggestions (${mrpCount})`);

  const accounts = await listAccounts(companyId);
  const byCode = new Map(accounts.map((a: { code: string; id: string }) => [a.code, a.id]));
  const byType = (t: string) => accounts.find((a: { type: string }) => a.type === t)?.id;
  const cash = byCode.get("1000") ?? byType("asset");
  const ar = byCode.get("1100") ?? byType("asset");
  const inv = byCode.get("1200") ?? byType("asset");
  const ap = byCode.get("2000") ?? byType("liability");
  const equity = byCode.get("3000") ?? byType("equity");
  const revenue = byCode.get("4000") ?? byType("revenue");
  const expense = byCode.get("5100") ?? byType("expense");
  if (!cash || !ar || !inv || !ap || !equity || !revenue || !expense) {
    throw new Error("chart of accounts is missing required codes after seeding");
  }
  const journalFixtures: Array<{ daysAgo: number; description: string; lines: Array<{ accountId: string; debit: number; credit: number }> }> = [
    { daysAgo: 45, description: "Founder capital contribution", lines: [{ accountId: cash, debit: 50000, credit: 0 }, { accountId: equity, debit: 0, credit: 50000 }] },
    { daysAgo: 32, description: "Office rent — month", lines: [{ accountId: expense, debit: 1800, credit: 0 }, { accountId: cash, debit: 0, credit: 1800 }] },
    { daysAgo: 21, description: "Customer payment — Acme Retail", lines: [{ accountId: cash, debit: 4200, credit: 0 }, { accountId: ar, debit: 0, credit: 4200 }] },
    { daysAgo: 12, description: "Utilities — electricity", lines: [{ accountId: expense, debit: 520, credit: 0 }, { accountId: cash, debit: 0, credit: 520 }] },
    { daysAgo: 6, description: "Inventory purchase on credit", lines: [{ accountId: inv, debit: 8500, credit: 0 }, { accountId: ap, debit: 0, credit: 8500 }] },
    { daysAgo: 2, description: "Consulting services billed", lines: [{ accountId: ar, debit: 2400, credit: 0 }, { accountId: revenue, debit: 0, credit: 2400 }] },
  ];
  for (const fixture of journalFixtures) {
    await createJournalEntry(companyId, users[ADMIN_EMAIL], {
      date: isoDaysAgo(fixture.daysAgo),
      description: fixture.description,
      reference: { type: "seed", id: `seed-${fixture.daysAgo}` },
      lines: fixture.lines.map((line) => ({ ...line, description: fixture.description })),
    });
  }
  console.log("[seed] 6 journal entries");

  const expenseFixtures: Array<{ description: string; amount: number; category: string; daysAgo: number }> = [
    { description: "AWS hosting — monthly", amount: 240, category: "software", daysAgo: 18 },
    { description: "Office coffee + snacks", amount: 130, category: "supplies", daysAgo: 15 },
    { description: "Google Ads campaign", amount: 950, category: "marketing", daysAgo: 9 },
    { description: "Team lunch — sales offsite", amount: 460, category: "travel", daysAgo: 7 },
    { description: "Adobe Creative Cloud", amount: 110, category: "software", daysAgo: 4 },
    { description: "Printer paper + ink", amount: 85, category: "supplies", daysAgo: 1 },
  ];
  for (const e of expenseFixtures) {
    await createExpense(companyId, users[ADMIN_EMAIL], { description: e.description, amount: e.amount, category: e.category, date: isoDaysAgo(e.daysAgo) });
  }
  console.log("[seed] 6 expenses");

  const claim = await createExpenseClaim(companyId, users[ADMIN_EMAIL], {
    items: [
      { description: "Client dinner", amount: 210, date: isoDaysAgo(10) },
      { description: "Uber to airport", amount: 65, date: isoDaysAgo(9) },
    ],
  });
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim.id, "submitted");
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim.id, "approved");
  const claim2 = await createExpenseClaim(companyId, users[ADMIN_EMAIL], {
    items: [{ description: "Hotel for conference", amount: 540, date: isoDaysAgo(5) }],
  });
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim2.id, "submitted");
  const claim3 = await createExpenseClaim(companyId, users[ADMIN_EMAIL], {
    items: [{ description: "Convention registration", amount: 320, date: isoDaysAgo(3) }],
  });
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim3.id, "submitted");
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim3.id, "approved");
  await updateExpenseClaimStatus(companyId, users[ADMIN_EMAIL], claim3.id, "paid");
  console.log("[seed] 3 expense claims (approved / submitted / paid)");

  for (const [fromCurrency, toCurrency, rate] of [["USD", "EUR", 0.92], ["USD", "GBP", 0.78], ["USD", "CAD", 1.36]] as const) {
    await upsertExchangeRate(companyId, users[ADMIN_EMAIL], { fromCurrency, toCurrency, rate, date: isoDaysAgo(0) });
  }
  console.log("[seed] 3 exchange rates");

  const departments: string[] = [];
  for (const name of ["Management", "Sales & Marketing", "Operations", "Finance", "Human Resources"]) {
    const dept = await createDepartment(companyId, users[ADMIN_EMAIL], { name });
    departments.push(dept.id);
  }
  const employees: Array<{ name: string; email: string; department: number; position: string; salary: number; hireDaysAgo: number; userId?: string; status?: string }> = [
    { name: "Omar Admin", email: ADMIN_EMAIL, department: 0, position: "Chief Executive", salary: 140000, hireDaysAgo: 400, userId: users[ADMIN_EMAIL] },
    { name: "Demo Manager", email: DEMO_EMAIL, department: 0, position: "Operations Manager", salary: 95000, hireDaysAgo: 350, userId: users[DEMO_EMAIL] },
    { name: "Lina Finance", email: "accountant@acme.demo", department: 3, position: "Accountant", salary: 68000, hireDaysAgo: 300, userId: users["accountant@acme.demo"] },
    { name: "Sam Support", email: "support@acme.demo", department: 1, position: "Support Specialist", salary: 52000, hireDaysAgo: 260, userId: users["support@acme.demo"] },
    { name: "Nour Employee", email: "employee@acme.demo", department: 2, position: "Warehouse Associate", salary: 42000, hireDaysAgo: 200, userId: users["employee@acme.demo"] },
    { name: "James Carter", email: "james.c@acme.demo", department: 1, position: "Sales Lead", salary: 82000, hireDaysAgo: 380 },
    { name: "Priya Nair", email: "priya.n@acme.demo", department: 2, position: "Production Planner", salary: 74000, hireDaysAgo: 320 },
    { name: "Marcus Webb", email: "marcus.w@acme.demo", department: 3, position: "Payroll Specialist", salary: 61000, hireDaysAgo: 290 },
    { name: "Sofia Reyes", email: "sofia.r@acme.demo", department: 4, position: "HR Generalist", salary: 58000, hireDaysAgo: 270 },
    { name: "Tom Baker", email: "tom.b@acme.demo", department: 2, position: "Forklift Operator", salary: 44000, hireDaysAgo: 180, status: "onLeave" },
  ];
  const employeeIds: string[] = [];
  for (const e of employees) {
    const doc = await createEmployee(companyId, users[ADMIN_EMAIL], {
      name: e.name,
      email: e.email,
      departmentId: departments[e.department],
      position: e.position,
      salary: e.salary,
      hireDate: isoDaysAgo(e.hireDaysAgo),
      userId: e.userId ?? null,
      status: e.status ?? "active",
    });
    employeeIds.push(doc.id);
  }
  console.log(`[seed] ${employees.length} employees in 5 departments`);

  const shiftPatternIds: string[] = [];
  for (const sp of [
    { name: "Standard", startTime: "09:00", endTime: "17:00", days: [1, 2, 3, 4, 5] },
    { name: "Early", startTime: "07:00", endTime: "15:00", days: [1, 2, 3, 4, 5] },
    { name: "Weekend", startTime: "10:00", endTime: "16:00", days: [6, 0] },
  ]) {
    const created = await createShiftPattern(companyId, users[ADMIN_EMAIL], { name: sp.name, startTime: sp.startTime, endTime: sp.endTime, days: sp.days });
    shiftPatternIds.push(created.id);
  }
  console.log("[seed] 3 shift patterns");

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 20);
  let attendanceDays = 0;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 6) continue;
    attendanceDays++;
    const day = d.getDate();
    const entries = employeeIds.map((employeeId, idx) => {
      if ((idx + day) % 17 === 0) return { employeeId, status: "absent" as const };
      if ((idx + day) % 11 === 0) return { employeeId, status: "late" as const };
      if ((idx + day) % 13 === 0) return { employeeId, status: "leave" as const };
      return { employeeId, status: "present" as const, shiftPatternId: shiftPatternIds[idx % 2] };
    });
    await bulkMarkAttendance(companyId, users[ADMIN_EMAIL], { date: d.toISOString().slice(0, 10), entries });
  }
  console.log(`[seed] attendance marked for ${attendanceDays} working days`);

  const timesheetFixtures: Array<{ employee: number; daysAgo: number; hours: number; project: string }> = [
    { employee: 1, daysAgo: 2, hours: 8, project: "Q3 operations review" },
    { employee: 5, daysAgo: 2, hours: 7.5, project: "Enterprise sales cycle" },
    { employee: 6, daysAgo: 1, hours: 8, project: "Production planning" },
    { employee: 7, daysAgo: 1, hours: 6, project: "Payroll reconciliation" },
    { employee: 8, daysAgo: 3, hours: 7, project: "Recruitment pipeline" },
    { employee: 2, daysAgo: 4, hours: 8, project: "Monthly close" },
    { employee: 4, daysAgo: 1, hours: 7, project: "Warehouse stocktake" },
    { employee: 6, daysAgo: 3, hours: 8, project: "MRP run support" },
  ];
  for (const t of timesheetFixtures) {
    const ts = await submitTimesheet(companyId, users[ADMIN_EMAIL], {
      employeeId: employeeIds[t.employee],
      date: isoDaysAgo(t.daysAgo),
      hours: t.hours,
      project: t.project,
      notes: "",
      status: "submitted",
    });
    if ((t.daysAgo + t.employee) % 2 === 0) {
      await approveTimesheet(companyId, users[ADMIN_EMAIL], ts.id, true);
    }
  }
  console.log("[seed] 8 timesheets");

  const leaves: Array<{ employee: number; type: "annual" | "sick" | "unpaid"; from: number; to: number; status: "approved" | "rejected" | "pending" }> = [
    { employee: 5, type: "annual", from: 25, to: 19, status: "approved" },
    { employee: 6, type: "annual", from: 14, to: 10, status: "pending" },
    { employee: 8, type: "sick", from: 9, to: 8, status: "approved" },
    { employee: 2, type: "annual", from: 30, to: 27, status: "pending" },
    { employee: 9, type: "sick", from: 6, to: 4, status: "approved" },
    { employee: 7, type: "unpaid", from: 40, to: 38, status: "rejected" },
  ];
  for (const l of leaves) {
    const leave = await requestLeave(companyId, users[ADMIN_EMAIL], {
      employeeId: employeeIds[l.employee],
      type: l.type,
      from: isoDaysAgo(l.from),
      to: isoDaysAgo(l.to),
      status: "pending",
    });
    if (l.status !== "pending") {
      await updateLeaveStatus(companyId, users[ADMIN_EMAIL], leave.id, l.status);
    }
  }
  console.log("[seed] 6 leave requests");

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevRun =   await generatePayrollRun(companyId, users[ADMIN_EMAIL], { month: prev.getMonth() + 1, year: prev.getFullYear() });
  await payPayrollRun(companyId, users[ADMIN_EMAIL], prevRun.id);
  await generatePayrollRun(companyId, users[ADMIN_EMAIL], { month: now.getMonth() + 1, year: now.getFullYear() });
  console.log("[seed] payroll: previous paid, current draft");

  await createNotification({ companyId, userId: users[DEMO_EMAIL], type: "system", title: "Welcome to Acme Demo", body: "This is a fully populated demo workspace.", link: "/dashboard" });
  await createNotification({ companyId, userId: users[DEMO_EMAIL], type: "order", title: "Order confirmed", body: "An order was confirmed by the team.", link: "/sales" });
  await createNotification({ companyId, userId: users[DEMO_EMAIL], type: "stock-alert", title: "Low stock alert", body: "Cable Kit Pro is below its reorder threshold.", link: "/inventory" });
  await createNotification({ companyId, userId: users[DEMO_EMAIL], type: "leave", title: "Leave approved", body: "James Carter's annual leave was approved.", link: "/hr" });
  await createNotification({ companyId, userId: users[ADMIN_EMAIL], type: "approval", title: "PO awaiting approval", body: "A purchase order over $1,000 needs your approval.", link: "/purchasing" });
  console.log("[seed] notifications created");

  await writeAudit({ companyId, userId: users[ADMIN_EMAIL], action: "create", entity: "Company", entityId: companyId, after: { seeded: true }, ip: "127.0.0.1" });
  console.log("[seed] done - demo company ready");
  console.log("  login: " + DEMO_EMAIL + " / " + PASSWORD + "   (user)");
  console.log("  login: " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD + "   (admin - full access)");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("[seed] failed", err);
  await mongoose.disconnect();
  process.exit(1);
});