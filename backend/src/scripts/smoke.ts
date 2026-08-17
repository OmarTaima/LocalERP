import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { RoleModel, SuperAdminModel } from "../models";

async function run(): Promise<void> {
  const mongod = await MongoMemoryReplSet.create({ replSet: { name: "rs0", count: 1 } });
  await mongod.waitUntilRunning();
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = mongod.getUri("erp");
  // Smoke must never touch real Cloudinary: pin the config vars to empty
  // so deleteImage no-ops instead of destroying real assets.
  process.env.CLOUDINARY_CLOUD_NAME = "";
  process.env.CLOUDINARY_API_KEY = "";
  process.env.CLOUDINARY_API_SECRET = "";

  const { app, connectDb } = await import("../index");
  await connectDb();

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const base = `http://localhost:${port}/api/v1`;

  const request = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  const expect = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
    console.log(`  ok: ${message}`);
  };

  const demoImage = (id: string): string => `https://imagedelivery.net/demo/${id}/public`;

  await SuperAdminModel.create({
    email: "superadmin@smoke.com",
    name: "Smoke Super Admin",
    passwordHash: await bcrypt.hash("SmokePass1", 12),
  });

  const superadminLogin = await request("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "superadmin@smoke.com", password: "SmokePass1" }),
  });
  expect(superadminLogin.status === 200 && typeof superadminLogin.body.accessToken === "string", "superadmin login returns token");
  const adminHeaders = { authorization: `Bearer ${superadminLogin.body.accessToken as string}` };
  const adminJsonHeaders = { "content-type": "application/json", ...adminHeaders };

  const createdCompany = await request("/admin/companies", {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "Acme Corp", slug: "acme-corp", plan: "enterprise" }),
  });
  expect(createdCompany.status === 201 && (createdCompany.body as { slug: string }).slug === "acme-corp", "superadmin provisions a company");
  const companyId = (createdCompany.body as { id: string }).id;

  const companyList = await request("/admin/companies", { headers: adminHeaders });
  expect((companyList.body as { total: number }).total === 1 && (companyList.body as { items: Array<{ usersCount: number }> }).items[0].usersCount === 0, "company list reports usersCount per company");

  const adminCompanyLogo = await request(`/admin/companies/${companyId}/logo`, {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ logoUrl: demoImage("logo-1") }),
  });
  expect(adminCompanyLogo.status === 200 && typeof adminCompanyLogo.body.logoUrl === "string" && (adminCompanyLogo.body.logoUrl as string).startsWith("https://"), "superadmin uploads company logo");

  const companyListWithLogo = await request("/admin/companies", { headers: adminHeaders });
  expect((companyListWithLogo.body as { items: Array<{ logoUrl: string | null }> }).items[0].logoUrl === adminCompanyLogo.body.logoUrl, "GET /admin/companies includes logoUrl");

  const adminRole = await RoleModel.findOne({ companyId, name: "admin" });
  const createdUser = await request(`/admin/companies/${companyId}/users`, {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "Omar Taimaa", email: "omar@acme.com", password: "SecurePass1", roleId: adminRole!._id.toString() }),
  });
  expect(createdUser.status === 201 && (createdUser.body as { roleId: string }).roleId === adminRole!._id.toString(), "superadmin creates a company user");

  const badLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "omar@acme.com", password: "WrongPass1" }),
  });
  expect(badLogin.status === 401, "wrong password rejected with 401");

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "omar@acme.com", password: "SecurePass1" }),
  });
  expect(login.status === 200 && typeof login.body.accessToken === "string", "valid login returns tokens");

  const accessToken = login.body.accessToken as string;
  const authHeaders = { authorization: `Bearer ${accessToken}` };

  const me = await request("/auth/me", { headers: authHeaders });
  expect(me.status === 200 && (me.body as { roleName?: string }).roleName === "admin", "GET /me returns admin user with permissions");

  const unauthorized = await request("/auth/me");
  expect(unauthorized.status === 401, "missing token rejected with 401");

  const users = await request("/users", { headers: authHeaders });
  expect(users.status === 200 && (users.body as { total?: number }).total === 1, "GET /users returns the admin user");

  const roles = await request("/roles", { headers: authHeaders });
  expect(roles.status === 200 && (roles.body as { total?: number }).total === 6, "system roles seeded (admin + 5 presets)");

  const invalidRole = await request("/roles", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "bad role", permissions: ["nonsense"] }),
  });
  expect(invalidRole.status === 400, "invalid role payload rejected by Joi with 400");

  const adminCompanyRoles = await request(`/admin/companies/${companyId}/roles`, { headers: adminHeaders });
  expect(
    adminCompanyRoles.status === 200 &&
      (adminCompanyRoles.body as unknown as Array<{ name: string; permissions: string[]; isSystem: boolean }>).some(
        (role) => role.name === "admin" && role.isSystem && role.permissions.includes("users:read"),
      ),
    "superadmin can list company roles for first-admin provisioning",
  );

  const authPermissionRole = await request("/roles", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "Operator", permissions: ["users:read", "roles:write", "catalog:read"] }),
  });
  expect(authPermissionRole.status === 201, "role with module:access permissions accepted by Joi");

  const allUsers = await request("/admin/users", { headers: adminHeaders });
  expect(
    allUsers.status === 200 &&
      (allUsers.body as { total: number }).total === 1 &&
      (allUsers.body as { items: Array<{ companyName: string; roleName: string }> }).items[0].companyName === "Acme Corp" &&
      (allUsers.body as { items: Array<{ companyName: string; roleName: string }> }).items[0].roleName === "admin",
    "GET /admin/users lists all users with companyName + roleName",
  );

  const adminUserSearch = await request("/admin/users?search=omar", { headers: adminHeaders });
  expect((adminUserSearch.body as { total: number }).total === 1, "GET /admin/users search filters by name");

  const companyLogo = await request("/company/logo", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ logoUrl: demoImage("logo-2") }),
  });
  expect(companyLogo.status === 200 && (companyLogo.body.logoUrl as string).startsWith("https://"), "company-scoped logo upload sets logoUrl");

  const avatarUser = await request("/users", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "Avatar Tester", email: "avatar@acme.com", password: "SecurePass3", avatarUrl: demoImage("avatar-1") }),
  });
  expect(avatarUser.status === 201 && (avatarUser.body.avatarUrl as string).startsWith("https://"), "company-scoped user create sets avatarUrl");
  const avatarUserId = (avatarUser.body as { id: string }).id;

  const avatarUserPatch = await request(`/users/${avatarUserId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ avatarUrl: demoImage("avatar-2") }),
  });
  expect(avatarUserPatch.status === 200 && (avatarUserPatch.body.avatarUrl as string).startsWith("https://"), "company-scoped user avatar replaced via PATCH");

  const adminCreatedUser = await request("/admin/users", {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "QA Analyst", email: "qa@acme.com", password: "SecurePass2", companyId }),
  });
  expect(
    adminCreatedUser.status === 201 &&
      (adminCreatedUser.body as { roleName: string }).roleName === "user" &&
      (adminCreatedUser.body as { companyName: string }).companyName === "Acme Corp",
    "POST /admin/users creates user with default company user role",
  );
  const adminUserId = (adminCreatedUser.body as { id: string }).id;

  const duplicateAdminEmail = await request("/admin/users", {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "QA Duplicate", email: "qa@acme.com", password: "SecurePass2", companyId }),
  });
  expect(duplicateAdminEmail.status === 409, "POST /admin/users rejects duplicate email with 409");

  const adminUserPatch = await request(`/admin/users/${adminUserId}`, {
    method: "PATCH",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "QA Lead", isActive: false }),
  });
  expect(adminUserPatch.status === 200 && (adminUserPatch.body as { name: string }).name === "QA Lead" && (adminUserPatch.body as { isActive: boolean }).isActive === false, "PATCH /admin/users/:id updates name + isActive");

  const adminAvatarUser = await request("/admin/users", {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "Admin Avatar", email: "admin-avatar@acme.com", password: "SecurePass4", companyId, avatarUrl: demoImage("avatar-3") }),
  });
  expect(adminAvatarUser.status === 201 && (adminAvatarUser.body.avatarUrl as string).startsWith("https://"), "POST /admin/users sets avatarUrl");
  const adminAvatarUserId = (adminAvatarUser.body as { id: string }).id;

  const adminAvatarPatch = await request(`/admin/users/${adminAvatarUserId}`, {
    method: "PATCH",
    headers: adminJsonHeaders,
    body: JSON.stringify({ avatarUrl: demoImage("avatar-4") }),
  });
  expect(adminAvatarPatch.status === 200 && (adminAvatarPatch.body.avatarUrl as string).startsWith("https://"), "PATCH /admin/users/:id updates avatarUrl");

  const adminUserDelete = await request(`/admin/users/${adminUserId}`, { method: "DELETE", headers: adminHeaders });
  expect(adminUserDelete.status === 200, "DELETE /admin/users/:id soft-deactivates user");

  const adminUserDeleteAgain = await request(`/admin/users/${adminUserId}`, { method: "DELETE", headers: adminHeaders });
  expect(adminUserDeleteAgain.status === 200, "DELETE /admin/users/:id is idempotent");

  const adminRoleCreated = await request(`/admin/companies/${companyId}/roles`, {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "QA Team", permissions: ["catalog:read", "catalog:create", "inventory:read"] }),
  });
  expect(adminRoleCreated.status === 201 && (adminRoleCreated.body as { isSystem: boolean }).isSystem === false, "superadmin creates a custom company role");
  const adminRoleId = (adminRoleCreated.body as { id: string }).id;

  const adminRoleDuplicate = await request(`/admin/companies/${companyId}/roles`, {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "QA Team", permissions: ["catalog:read"] }),
  });
  expect(adminRoleDuplicate.status === 409, "duplicate role name in company rejected with 409");

  const adminRolePresetName = await request(`/admin/companies/${companyId}/roles`, {
    method: "POST",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "admin", permissions: ["catalog:read"] }),
  });
  expect(adminRolePresetName.status === 400, "role named after a system preset rejected with 400");

  const adminRolePatch = await request(`/admin/companies/${companyId}/roles/${adminRoleId}`, {
    method: "PATCH",
    headers: adminJsonHeaders,
    body: JSON.stringify({ permissions: ["catalog:read", "inventory:read", "sales:read"] }),
  });
  expect(adminRolePatch.status === 200 && (adminRolePatch.body as { permissions: string[] }).permissions.includes("sales:read"), "superadmin updates custom role permissions");

  const adminSystemRoleRename = await request(`/admin/companies/${companyId}/roles/${adminRole!._id.toString()}`, {
    method: "PATCH",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "Renamed Admin" }),
  });
  expect(adminSystemRoleRename.status === 400, "system role rename rejected with 400");

  const adminRoleDelete = await request(`/admin/companies/${companyId}/roles/${adminRoleId}`, { method: "DELETE", headers: adminHeaders });
  expect(adminRoleDelete.status === 200, "superadmin deletes an unassigned custom role");

  const adminSystemRoleDelete = await request(`/admin/companies/${companyId}/roles/${adminRole!._id.toString()}`, { method: "DELETE", headers: adminHeaders });
  expect(adminSystemRoleDelete.status === 400, "system role deletion rejected with 400");

  const audit = await request("/audit-logs", { headers: authHeaders });
  expect(audit.status === 200 && ((audit.body as { total?: number }).total ?? 0) >= 1, "audit log records login event");

  const refresh = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: login.body.refreshToken ?? "" }),
  });
  expect(refresh.status === 200 && typeof refresh.body.accessToken === "string", "refresh token rotation works");

  const logout = await request("/auth/logout", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ refreshToken: refresh.body.refreshToken ?? "" }),
  });
  expect(logout.status === 200, "logout revokes session");

  const refreshAfterLogout = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refresh.body.refreshToken ?? "" }),
  });
  expect(refreshAfterLogout.status === 401, "revoked refresh token rejected");

  const jsonHeaders = { "content-type": "application/json", ...authHeaders };
  const post = (path: string, body: unknown) => request(path, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });

  const warehouseA = await post("/warehouses", { name: "Main Warehouse", isDefault: true });
  const warehouseB = await post("/warehouses", { name: "Secondary Warehouse" });
  expect(warehouseA.status === 201 && warehouseB.status === 201, "warehouses created");

  const warehouses = await request("/warehouses", { headers: authHeaders });
  expect((warehouses.body as unknown as unknown[]).length === 2, "warehouse list returns 2 warehouses");

  const category = await post("/categories", { name: "Electronics" });
  expect(category.status === 201, "category created");

  const categories = await request("/categories", { headers: authHeaders });
  expect((categories.body as unknown as unknown[]).length === 1, "category tree returns the category");

  const product = await post("/products", {
    sku: "SKU-1001",
    name: "Wireless Keyboard",
    price: 49.99,
    cost: 22.5,
    categoryId: (category.body as { id: string }).id,
    lowStockThreshold: 5,
  });
  expect(product.status === 201, "product created");
  const productId = (product.body as { id: string }).id;

  const productWithImage = await post("/products", {
    sku: "SKU-1003",
    name: "Keyboard with photo",
    price: 59.99,
    cost: 30,
    image: demoImage("product-1"),
  });
  expect(productWithImage.status === 201 && ((productWithImage.body as { images: string[] }).images[0] ?? "").startsWith("https://"), "product photo upload sets images[0]");

  const productPhotoPatch = await request(`/products/${productId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ image: demoImage("product-2") }),
  });
  expect(productPhotoPatch.status === 200 && ((productPhotoPatch.body as { images: string[] }).images[0] ?? "").startsWith("https://"), "product photo replaced via PATCH");

  const duplicateProduct = await post("/products", { sku: "SKU-1001", name: "Duplicate", price: 1, cost: 1 });
  expect(duplicateProduct.status === 409, "duplicate sku rejected with 409");

  const adjust = await post(`/products/${productId}/stock-adjust`, {
    warehouseId: (warehouseA.body as { id: string }).id,
    quantity: 100,
    note: "initial stock",
  });
  expect(adjust.status === 200 && (adjust.body as { after: number }).after === 100, "stock adjusted to 100");

  const movements = await request(`/products/${productId}/movements`, { headers: authHeaders });
  expect((movements.body as { total: number }).total === 1, "stock movement ledger records the adjustment");

  const overdraw = await post(`/products/${productId}/stock-adjust`, {
    warehouseId: (warehouseA.body as { id: string }).id,
    quantity: -500,
  });
  expect(overdraw.status === 400, "overdraw rejected — stock cannot go negative");

  const lowStockBefore = await request("/inventory/low-stock", { headers: authHeaders });
  expect((lowStockBefore.body as unknown as unknown[]).length === 0, "product not flagged low-stock at 100 units");

  await post(`/products/${productId}/stock-adjust`, {
    warehouseId: (warehouseA.body as { id: string }).id,
    quantity: -97,
    note: "sell down",
  });
  const lowStockAfter = await request("/inventory/low-stock", { headers: authHeaders });
  expect((lowStockAfter.body as unknown as unknown[]).length === 1, "product flagged low-stock at 3 units (threshold 5)");

  const transfer = await post("/warehouses/transfer", {
    fromWarehouseId: (warehouseA.body as { id: string }).id,
    toWarehouseId: (warehouseB.body as { id: string }).id,
    items: [{ productId, quantity: 2 }],
  });
  expect(transfer.status === 201, "transfer created (in-transit)");
  const transferId = (transfer.body as { id: string }).id;

  const receive = await post(`/warehouses/transfers/${transferId}/receive`, {});
  expect(receive.status === 200, "transfer received");

  const transferMovements = await request(`/products/${productId}/movements`, { headers: authHeaders });
  expect((transferMovements.body as { total: number }).total === 4, "transfer created two ledger entries (out + in)");

  const reorderRule = await post("/reorder-rules", {
    productId,
    warehouseId: (warehouseA.body as { id: string }).id,
    minQuantity: 10,
    maxQuantity: 50,
  });
  expect(reorderRule.status === 201, "reorder rule created");

  const generate = await post("/mrp/generate", {});
  expect(generate.status === 200 && (generate.body as { created: number }).created >= 1, "MRP generates purchase suggestion (stock 1 < min 10)");

  const suggestions = await request("/mrp/suggestions", { headers: authHeaders });
  expect((suggestions.body as { total: number }).total >= 1, "MRP suggestion listed");

  const unauthorizedProduct = await request("/products", { method: "POST", body: JSON.stringify({ sku: "X", name: "X", price: 1, cost: 1 }) });
  expect(unauthorizedProduct.status === 401, "unauthenticated product creation rejected with 401");

  const customer = await post("/customers", {
    email: "buyer@acme.com",
    name: "Acme Buyer",
    creditLimit: 1000,
    addresses: [{ label: "HQ", street: "1 Main St", city: "Springfield", country: "USA" }],
  });
  expect(customer.status === 201, "customer created");

  const customers = await request("/customers?search=buyer", { headers: authHeaders });
  expect((customers.body as { total: number }).total === 1, "customer search matches by name");

  const quote = await post("/quotes", {
    customerId: (customer.body as { id: string }).id,
    items: [{ productId, name: "Wireless Keyboard", sku: "SKU-1001", quantity: 2, unitPrice: 49.99, taxRate: 0 }],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(quote.status === 201 && (quote.body as { quoteNumber: string }).quoteNumber === "QT-00001", "quote created with sequential number");
  const quoteId = (quote.body as { id: string }).id;

  const sentQuote = await request(`/quotes/${quoteId}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "sent" }) });
  expect(sentQuote.status === 200 && (sentQuote.body as { status: string }).status === "sent", "quote marked sent");

  const converted = await post(`/quotes/${quoteId}/convert`, {});
  expect(converted.status === 201 && (converted.body as { orderNumber: string }).orderNumber === "ORD-00001", "quote converted to order");
  const orderId = (converted.body as { id: string }).id;

  const confirmed = await request(`/orders/${orderId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "confirmed" }) });
  expect(confirmed.status === 200 && (confirmed.body as { status: string }).status === "confirmed", "order confirmed");

  const invalidTransition = await request(`/orders/${orderId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "delivered" }) });
  expect(invalidTransition.status === 400, "invalid order transition rejected with 400");

  const topUp = await post(`/products/${productId}/stock-adjust`, {
    warehouseId: (warehouseA.body as { id: string }).id,
    quantity: 10,
    note: "stock for sales",
  });
  expect(topUp.status === 200, "stock topped up before shipment");

  const payment = await post(`/orders/${orderId}/payments`, { amount: 99.98, method: "cash", reference: "till-1", idempotencyKey: "PAY-ACME-0001" });
  expect(payment.status === 201 && (payment.body as { status: string }).status === "captured", "payment captured");

  const duplicatePayment = await post(`/orders/${orderId}/payments`, { amount: 99.98, method: "cash", idempotencyKey: "PAY-ACME-0001" });
  expect((duplicatePayment.body as { duplicate?: boolean }).duplicate === true, "duplicate payment idempotency key returns the original");

  const overpay = await post(`/orders/${orderId}/payments`, { amount: 10, method: "cash", idempotencyKey: "PAY-ACME-0002" });
  expect(overpay.status === 400, "overpayment rejected with 400");

  const paidOrder = await request(`/orders/${orderId}`, { headers: authHeaders });
  expect((paidOrder.body as { status: string }).status === "paid", "order marked paid after full payment");

  const shipment = await post("/shipments", {
    orderId,
    carrier: "DHL",
    trackingNumber: "DHL-123",
    pickList: [{ productId, quantity: 2, fromWarehouseId: (warehouseA.body as { id: string }).id }],
  });
  expect(shipment.status === 201 && (shipment.body as { status: string }).status === "draft", "shipment created from pick list");
  const shipmentId = (shipment.body as { id: string }).id;

  await request(`/shipments/${shipmentId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "packed" }) });
  const shipped = await request(`/shipments/${shipmentId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "shipped" }) });
  expect(shipped.status === 200 && (shipped.body as { status: string }).status === "shipped", "shipment shipped");

  const shippedOrder = await request(`/orders/${orderId}`, { headers: authHeaders });
  expect((shippedOrder.body as { status: string }).status === "shipped", "order follows shipment status");

  const movementsAfterShip = await request(`/products/${productId}/movements`, { headers: authHeaders });
  expect((movementsAfterShip.body as { total: number }).total === 6, "shipment deducts stock and records a sold movement");

  await request(`/shipments/${shipmentId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "delivered" }) });

  const rma = await post("/rmas", {
    orderId,
    items: [{ productId, quantity: 1, condition: "defective" }],
    reason: "customer reported defect",
  });
  expect(rma.status === 201 && (rma.body as { rmaNumber: string }).rmaNumber === "RMA-00001", "RMA requested with sequential number");
  const rmaId = (rma.body as { id: string }).id;

  await request(`/rmas/${rmaId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "approved" }) });
  await request(`/rmas/${rmaId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "received" }) });
  const refundedRma = await request(`/rmas/${rmaId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "refunded" }) });
  expect(refundedRma.status === 200 && (refundedRma.body as { status: string }).status === "refunded", "RMA refunded");

  const refundedOrder = await request(`/orders/${orderId}`, { headers: authHeaders });
  expect((refundedOrder.body as { status: string }).status === "refunded", "order refunded after RMA");
  expect(((refundedOrder.body as { timeline: { payments: unknown[] } }).timeline.payments as unknown[]).length === 2, "refund payment recorded in order timeline");

  const movementsAfterRma = await request(`/products/${productId}/movements`, { headers: authHeaders });
  expect((movementsAfterRma.body as { total: number }).total === 7, "RMA restock records a returned movement");

  const recurring = await post("/recurring-invoices", {
    customerId: (customer.body as { id: string }).id,
    items: [{ productId, name: "Monthly Keyboard", quantity: 1, unitPrice: 39.99 }],
    interval: "monthly",
    dayOfPeriod: 15,
  });
  expect(recurring.status === 201 && (recurring.body as { status: string }).status === "active", "recurring invoice created active");
  const recurringId = (recurring.body as { id: string }).id;

  const pausedRecurring = await request(`/recurring-invoices/${recurringId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "paused" }) });
  expect(pausedRecurring.status === 200 && (pausedRecurring.body as { status: string }).status === "paused", "recurring invoice paused");

  const unauthorizedOrders = await request("/orders");
  expect(unauthorizedOrders.status === 401, "unauthenticated orders access rejected with 401");

  const accounts = await request("/accounts", { headers: authHeaders });
  expect((accounts.body as unknown as unknown[]).length === 13, "default chart of accounts seeded lazily (13 accounts)");
  const cashAccount = (accounts.body as unknown as Array<{ code: string; id: string }>).find((account) => account.code === "1000");
  const revenueAccount = (accounts.body as unknown as Array<{ code: string; id: string }>).find((account) => account.code === "4000");
  const arAccount = (accounts.body as unknown as Array<{ code: string; id: string }>).find((account) => account.code === "1100");
  expect(cashAccount !== undefined && revenueAccount !== undefined && arAccount !== undefined, "cash / revenue / AR accounts present");

  const customAccount = await post("/accounts", { code: "1250", name: "Prepaid Rent", type: "asset" });
  expect(customAccount.status === 201 && (customAccount.body as { isSystem: boolean }).isSystem === false, "custom account created as non-system");

  const journal = await post("/journal-entries", {
    date: new Date().toISOString(),
    description: "Manual adjustment",
    reference: { type: "manual", id: "adj-1" },
    lines: [
      { accountId: (revenueAccount as { id: string }).id, debit: 0, credit: 500, description: "consulting" },
      { accountId: (cashAccount as { id: string }).id, debit: 500, credit: 0, description: "cash in" },
    ],
  });
  expect(journal.status === 201 && (journal.body as { entryNumber: string }).entryNumber === "JE-00001", "balanced journal entry posted with sequential number");
  const journalId = (journal.body as { id: string }).id;

  const unbalanced = await post("/journal-entries", {
    date: new Date().toISOString(),
    description: "Broken",
    reference: { type: "manual", id: "adj-2" },
    lines: [
      { accountId: (revenueAccount as { id: string }).id, debit: 0, credit: 500 },
      { accountId: (cashAccount as { id: string }).id, debit: 100, credit: 0 },
    ],
  });
  expect(unbalanced.status === 400, "unbalanced journal entry rejected with 400");

  const expense = await post("/expenses", { description: "Office rent", amount: 300, category: "rent", date: new Date().toISOString() });
  expect(expense.status === 201 && (expense.body as { journalEntryId: string | null }).journalEntryId !== null, "expense auto-posts a journal entry");

  const claim = await post("/expense-claims", { items: [{ description: "Client lunch", amount: 80, date: new Date().toISOString() }] });
  expect(claim.status === 201 && (claim.body as { total: number }).total === 80, "expense claim created with computed total");
  const claimId = (claim.body as { id: string }).id;

  await request(`/expense-claims/${claimId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "submitted" }) });
  const approvedClaim = await request(`/expense-claims/${claimId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "approved" }) });
  expect(approvedClaim.status === 200 && (approvedClaim.body as { status: string }).status === "approved", "expense claim approved");

  const paidClaim = await request(`/expense-claims/${claimId}/status`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ status: "paid" }) });
  expect(paidClaim.status === 200 && (paidClaim.body as { status: string }).status === "paid", "expense claim paid and journaled");

  const pnl = await request("/reports/pnl", { headers: authHeaders });
  expect((pnl.body as { revenueTotal: number }).revenueTotal === 500 && (pnl.body as { expenseTotal: number }).expenseTotal === 380, "P&L aggregates revenue (500) and expenses (300 rent + 80 claim)");

  const balanceSheet = await request("/reports/balance-sheet", { headers: authHeaders });
  expect((balanceSheet.body as { balanced: boolean }).balanced === true, "balance sheet balances");

  const reversed = await post(`/journal-entries/${journalId}/reverse`, {});
  expect(reversed.status === 201, "journal entry reversed with mirror lines");

  const doubleReverse = await post(`/journal-entries/${journalId}/reverse`, {});
  expect(doubleReverse.status === 400, "already-reversed entry cannot be reversed again");

  const trialBalance = await request("/reports/trial-balance", { headers: authHeaders });
  expect((trialBalance.body as { balanced: boolean }).balanced === true, "trial balance stays balanced after reversal");

  const rate = await post("/exchange-rates", { fromCurrency: "USD", toCurrency: "EUR", rate: 0.92 });
  expect(rate.status === 201 && (rate.body as { rate: number }).rate === 0.92, "exchange rate upserted");

  const agingAr = await request("/reports/aging?type=ar", { headers: authHeaders });
  expect((agingAr.body as { type: string }).type === "ar", "AR aging report renders");

  const supplier = await post("/suppliers", { name: "Switch Corp", email: "sales@switchcorp.com", paymentTerms: "net30" });
  expect(supplier.status === 201, "supplier created");
  const supplierId = (supplier.body as { id: string }).id;

  const openBeforeAction = await request("/mrp/suggestions?status=open", { headers: authHeaders });
  const purchaseSuggestion = (openBeforeAction.body as { items: Array<{ id: string; type: string }> }).items.find((item) => item.type === "purchase");
  expect(purchaseSuggestion !== undefined, "open purchase suggestion listed");
  const actionedPurchase = await post(`/mrp/suggestions/${(purchaseSuggestion as { id: string }).id}/action`, { status: "actioned" });
  expect((actionedPurchase.body as { type: string }).type === "purchase" && (actionedPurchase.body as { created: { number: string } }).created?.number.startsWith("PO-"), "purchase suggestion actioned into a PO draft");

  const smallPo = await post("/purchase-orders", {
    supplierId,
    items: [{ productId, quantity: 5, unitCost: 20 }],
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(smallPo.status === 201 && (smallPo.body as { status: string }).status === "sent", "small PO auto-sent below approval threshold");
  const smallPoId = (smallPo.body as { id: string }).id;

  const grn = await post(`/purchase-orders/${smallPoId}/receive`, {});
  expect(grn.status === 200 && (grn.body as { grnNumber: string }).grnNumber === "GRN-00001", "GRN received into default warehouse");
  expect((grn.body as { status: string }).status === "received", "PO marked received after full GRN");

  const batches = await request("/batches", { headers: authHeaders });
  expect((batches.body as unknown as Array<{ lotNumber: string }>).some((batch) => batch.lotNumber.startsWith("GRN-")), "GRN creates a tracked batch");

  const component = await post("/products", { sku: "SKU-1002", name: "Key Switch", price: 1, cost: 0.5 });
  expect(component.status === 201, "component product created");
  const componentId = (component.body as { id: string }).id;
  await post(`/products/${componentId}/stock-adjust`, { warehouseId: (warehouseA.body as { id: string }).id, quantity: 100 });

  const workCenter = await post("/work-centers", { name: "Assembly Line", costPerHour: 10, capacity: 8 });
  expect(workCenter.status === 201, "work center created");
  const workCenterId = (workCenter.body as { id: string }).id;

  const bom = await post("/boms", { productId, components: [{ productId: componentId, quantity: 1 }], outputQuantity: 1 });
  expect(bom.status === 201, "BOM created for finished good");
  const bomId = (bom.body as { id: string }).id;

  const workOrder = await post("/work-orders", { bomId, quantity: 4, workCenterId, plannedHours: 1 });
  expect(workOrder.status === 201 && (workOrder.body as { woNumber: string }).woNumber === "WO-00001", "work order created with sequential number");
  const workOrderId = (workOrder.body as { id: string }).id;

  const started = await post(`/work-orders/${workOrderId}/start`, {});
  expect(started.status === 200 && (started.body as { status: string }).status === "in-progress", "work order started and materials consumed");

  const completed = await post(`/work-orders/${workOrderId}/receive`, {});
  expect(completed.status === 200 && (completed.body as { status: string }).status === "completed", "work order completed");
  expect((completed.body as { unitCost: number }).unitCost === 3, "unit cost rolled up ((4x0.5 + 10)/4)");

  const bigPo = await post("/purchase-orders", {
    supplierId,
    items: [{ productId, quantity: 2, unitCost: 600 }],
    expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(bigPo.status === 201 && (bigPo.body as { status: string }).status === "pending-approval", "large PO routed to approval workflow");
  const bigPoId = (bigPo.body as { id: string }).id;

  const approvals = await request("/approval-requests", { headers: authHeaders });
  expect((approvals.body as { total: number }).total === 1, "approval queue shows the pending request");

  const approvedPo = await post(`/purchase-orders/${bigPoId}/approve`, { approved: true, note: "ok" });
  expect(approvedPo.status === 200 && (approvedPo.body as { status: string }).status === "sent", "PO approval moves it to sent");

  await post(`/purchase-orders/${bigPoId}/receive`, {});
  const receivedBigPo = await request(`/purchase-orders/${bigPoId}`, { headers: authHeaders });
  expect((receivedBigPo.body as { status: string }).status === "received", "large PO received");

  const rejectPo = await post("/purchase-orders", {
    supplierId,
    items: [{ productId, quantity: 1, unitCost: 1500 }],
    expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const rejectedPo = await post(`/purchase-orders/${(rejectPo.body as { id: string }).id}/approve`, { approved: false, note: "too expensive" });
  expect(rejectedPo.status === 200 && (rejectedPo.body as { status: string }).status === "rejected", "PO rejection recorded");

  await post(`/products/${productId}/stock-adjust`, { warehouseId: (warehouseA.body as { id: string }).id, quantity: -20 });
  const mrpProduce = await post("/mrp/generate", {});
  expect((mrpProduce.body as { created: number }).created >= 1, "MRP generates produce suggestion when BOM exists");

  const openSuggestions = await request("/mrp/suggestions?status=open", { headers: authHeaders });
  const produceSuggestion = (openSuggestions.body as { items: Array<{ id: string; type: string }> }).items.find((item) => item.type === "produce");
  expect(produceSuggestion !== undefined, "open produce suggestion listed");

  const actionedProduce = await post(`/mrp/suggestions/${(produceSuggestion as { id: string }).id}/action`, { status: "actioned" });
  expect((actionedProduce.body as { type: string }).type === "produce" && (actionedProduce.body as { created: { number: string } }).created?.number.startsWith("WO-"), "produce suggestion actioned into a work order");

  const trialBalanceAfterOps = await request("/reports/trial-balance", { headers: authHeaders });
  expect((trialBalanceAfterOps.body as { balanced: boolean }).balanced === true, "trial balance balanced after purchasing + manufacturing postings");

  const department = await post("/departments", { name: "Engineering", parentId: null, headUserId: null });
  expect(department.status === 201, "department created");
  const departmentId = (department.body as { id: string }).id;

  const engineer = await post("/employees", { name: "Ada Lovelace", email: "ada@example.com", departmentId, position: "Engineer", salary: 60000, hireDate: "2025-01-10" });
  expect(engineer.status === 201 && (engineer.body as { status: string }).status === "active", "employee created as active");
  const engineerId = (engineer.body as { id: string }).id;

  const manager = await post("/employees", { name: "Grace Hopper", email: "grace@example.com", departmentId, position: "Manager", salary: 120000, hireDate: "2024-06-01" });
  expect(manager.status === 201, "second employee created");
  const managerId = (manager.body as { id: string }).id;

  const employeeSearch = await request("/employees?search=hopper", { headers: authHeaders });
  expect((employeeSearch.body as { total: number }).total === 1, "employee search matches by name");

  const attendance = await post("/attendance", { date: "2026-08-17", entries: [{ employeeId: engineerId, status: "present" }, { employeeId: managerId, status: "late", note: "traffic" }] });
  expect(attendance.status === 201 && (attendance.body as { count: number }).count === 2, "bulk attendance marked");

  const attendanceGrid = await request("/attendance?month=8&year=2026", { headers: authHeaders });
  expect((attendanceGrid.body as unknown as Array<{ status: string }>).some((mark) => mark.status === "late"), "attendance month grid renders marks");

  const timesheet = await post("/timesheets", { employeeId: engineerId, date: "2026-08-17", hours: 8, project: "ERP build", notes: "" });
  expect(timesheet.status === 201 && (timesheet.body as { status: string }).status === "submitted", "timesheet submitted");
  const timesheetId = (timesheet.body as { id: string }).id;

  const approvedTimesheet = await request(`/timesheets/${timesheetId}/approve`, { method: "PATCH", body: JSON.stringify({ approved: true }), headers: jsonHeaders });
  expect((approvedTimesheet.body as { status: string }).status === "approved", "timesheet approved");

  const leave = await post("/leaves", { employeeId: managerId, type: "annual", from: "2026-09-01", to: "2026-09-05", days: 5 });
  expect(leave.status === 201 && (leave.body as { status: string }).status === "pending", "leave request created");
  const leaveId = (leave.body as { id: string }).id;

  const approvedLeave = await request(`/leaves/${leaveId}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }), headers: jsonHeaders });
  expect((approvedLeave.body as { status: string }).status === "approved", "leave approved via approvals flow");

  const shiftPattern = await post("/shift-patterns", { name: "Morning", startTime: "08:00", endTime: "17:00", days: [0, 1, 2, 3, 4, 5, 6] });
  expect(shiftPattern.status === 201, "shift pattern created");

  const payroll = await post("/payroll/runs", { month: 8, year: 2026 });
  expect(payroll.status === 201 && (payroll.body as { entries: unknown[] }).entries.length === 2, "payroll run computed for active employees");
  expect((payroll.body as { entries: Array<{ net: number }> }).entries.reduce((sum, entry) => sum + entry.net, 0) === 12000, "payroll components computed (gross/12 minus 20% tax)");
  const payrollRunId = (payroll.body as { id: string }).id;

  const paidRun = await post(`/payroll/runs/${payrollRunId}/pay`, {});
  expect(paidRun.status === 200 && (paidRun.body as { status: string }).status === "paid" && (paidRun.body as { paidAt: string | null }).paidAt !== null, "payroll run paid with journal postings");

  const duplicatePayroll = await post("/payroll/runs", { month: 8, year: 2026 });
  expect(duplicatePayroll.status === 409, "duplicate payroll period rejected");

  const terminated = await request(`/employees/${managerId}`, { method: "DELETE", headers: jsonHeaders });
  expect(terminated.status === 200 && (terminated.body as { status: string }).status === "terminated", "employee terminated");

  const trialBalanceAfterHr = await request("/reports/trial-balance", { headers: authHeaders });
  expect((trialBalanceAfterHr.body as { balanced: boolean }).balanced === true, "trial balance balanced after payroll postings");

  const stats = await request("/dashboard/stats", { headers: authHeaders });
  expect((stats.body as { orders: number }).orders >= 1 && (stats.body as { revenue: number }).revenue >= 0, "dashboard stats compute order counts");
  expect(Array.isArray((stats.body as { chartSeries: unknown[] }).chartSeries), "dashboard chart series materialized");
  expect((stats.body as { inventoryValue: number }).inventoryValue > 0 && (stats.body as { lowStockCount: number }).lowStockCount >= 1, "inventory value and low stock KPIs reported");

  const approvalsDash = await request("/dashboard/approvals", { headers: authHeaders });
  expect((approvalsDash.body as { total: number }).total >= 0, "approval queue widget renders");

  const alerts = await request("/dashboard/alerts", { headers: authHeaders });
  expect((alerts.body as { lowStock: unknown[] }).lowStock.length >= 1, "low stock alert surfaced");

  const importProducts = await post("/imports", { type: "products", data: "sku,name,price,cost\nIMP-001,Imported Widget,25,10\nIMP-001,Duplicate SKU,5,1" });
  expect(importProducts.status === 201 && (importProducts.body as { result: { processed: number } }).result.processed === 1 && (importProducts.body as { result: { failed: number } }).result.failed === 1, "product import processes valid rows and records row errors");
  const importJobId = (importProducts.body as { id: string }).id;

  const importStatus = await request(`/imports/${importJobId}`, { headers: authHeaders });
  expect((importStatus.body as { status: string }).status === "done", "import job status queryable");

  const importCustomers = await post("/imports", { type: "customers", data: "name,email,phone\nBulk Buyer,bulk@example.com,5550100" });
  expect((importCustomers.body as { result: { processed: number } }).result.processed === 1, "customer import creates records");

  const exportProducts = await request("/exports?type=products", { headers: authHeaders });
  expect(exportProducts.status === 201 && (exportProducts.body as { status: string }).status === "done", "export job generated");
  const exportJobId = (exportProducts.body as { id: string }).id;

  const exportDownload = await fetch(`${base}/exports/${exportJobId}/download`, { headers: authHeaders });
  expect((await exportDownload.text()).includes("SKU-1001"), "export download returns CSV rows");

  const auditExport = await fetch(`${base}/audit-logs/export`, { headers: authHeaders });
  expect((await auditExport.text()).includes("entityId"), "audit compliance export renders CSV");

  const fxGainAccount = await post("/accounts", { code: "4900", name: "FX Gains", type: "revenue" });
  const fxLossAccount = await post("/accounts", { code: "4901", name: "FX Losses", type: "expense" });
  expect(fxGainAccount.status === 201 && fxLossAccount.status === 201, "FX revaluation accounts created");

  const eurRate = await post("/exchange-rates", { fromCurrency: "EUR", toCurrency: "USD", rate: 1.1 });
  expect(eurRate.status === 201, "EUR rate stored");

  const eurEntry = await post("/journal-entries", {
    date: "2026-08-16",
    description: "EUR receivable posting",
    reference: { type: "manual", id: "fx-test" },
    lines: [
      { accountId: (arAccount as { id: string }).id, debit: 1000, credit: 0, currency: "EUR", fxRate: 1 },
      { accountId: (customAccount.body as { id: string }).id, debit: 0, credit: 1000, currency: "EUR", fxRate: 1 },
    ],
  });
  expect(eurEntry.status === 201, "multi-currency journal entry posted");

  const revaluation = await post("/reports/fx-revaluation", {});
  expect(revaluation.status === 200 && (revaluation.body as { entryNumber: string | null }).entryNumber !== null, "period-end FX revaluation posts entry");

  const trialBalanceAfterFx = await request("/reports/trial-balance", { headers: authHeaders });
  expect((trialBalanceAfterFx.body as { balanced: boolean }).balanced === true, "trial balance balanced after FX revaluation");

  const recurringRun = await post("/recurring-invoices/run", {});
  expect(recurringRun.status === 200 && (recurringRun.body as { ran: number }).ran >= 0, "recurring invoice cron hook runs");

  const companyRename = await request(`/admin/companies/${companyId}`, {
    method: "PATCH",
    headers: adminJsonHeaders,
    body: JSON.stringify({ name: "Acme Corp Renewed" }),
  });
  expect(companyRename.status === 200 && (companyRename.body as { name: string }).name === "Acme Corp Renewed", "PATCH /admin/companies/:id updates name");

  const companyDelete = await request(`/admin/companies/${companyId}`, { method: "DELETE", headers: adminHeaders });
  expect(companyDelete.status === 200, "DELETE /admin/companies/:id soft-deactivates company");

  const companyDeleteAgain = await request(`/admin/companies/${companyId}`, { method: "DELETE", headers: adminHeaders });
  expect(companyDeleteAgain.status === 200, "DELETE /admin/companies/:id is idempotent");

  const companyDeleteMissing = await request("/admin/companies/000000000000000000000000", { method: "DELETE", headers: adminHeaders });
  expect(companyDeleteMissing.status === 404, "DELETE /admin/companies/:id 404s for missing company");

  const companyListAfterDelete = await request("/admin/companies", { headers: adminHeaders });
  expect((companyListAfterDelete.body as { items: Array<{ id: string; isActive: boolean }> }).items.find((item) => item.id === companyId)?.isActive === false, "deleted company listed with isActive false");

  server.close();
  await mongooseDisconnect();
  await mongod.stop();
  console.log("\nSMOKE TEST PASSED — auth, company scoping, catalog, inventory, MRP, sales, finance, purchasing, manufacturing, HR, system verified end-to-end");
}

import mongoose from "mongoose";
async function mongooseDisconnect(): Promise<void> {
  await mongoose.disconnect();
}

run().catch((err: unknown) => {
  console.error("\nSMOKE TEST FAILED", err);
  process.exit(1);
});