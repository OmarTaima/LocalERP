import { Router } from "express";
import {
  customerSchema,
  customerUpdateSchema,
  orderCreateSchema,
  orderStatusSchema,
  paymentCreateSchema,
  quoteSchema,
  quoteUpdateSchema,
  recurringInvoiceSchema,
  recurringStatusSchema,
  rmaSchema,
  rmaStatusSchema,
  shipmentSchema,
  shipmentStatusSchema,
} from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parseDateRange, parsePagination } from "../utils/pagination";
import {
  convertQuote,
  createCustomer,
  createOrder,
  createPayment,
  createQuote,
  createRecurringInvoice,
  createRma,
  createShipment,
  getCustomer,
  getOrder,
  getQuote,
  listCustomers,
  listOrders,
  listQuotes,
  listRecurringInvoices,
  listRmas,
  listShipments,
  updateCustomer,
  updateOrderStatus,
  updateQuote,
  updateRecurringStatus,
  updateRmaStatus,
  updateShipmentStatus,
} from "../services/sales.service";

export const salesRouter = Router();

salesRouter.use(auth, company);

salesRouter.get("/customers", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listCustomers(req.companyId, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/customers", rbac("sales:write"), validate(customerSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createCustomer(req.companyId, req.userId, req.body));
}));

salesRouter.get("/customers/:id", rbac("sales:read"), asyncHandler(async (req, res) => {
  res.json(await getCustomer(req.companyId, req.params.id));
}));

salesRouter.patch("/customers/:id", rbac("sales:write"), validate(customerUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateCustomer(req.companyId, req.userId, req.params.id, req.body));
}));

salesRouter.get("/quotes", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listQuotes(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      customerId: typeof req.query.customerId === "string" ? req.query.customerId : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/quotes", rbac("sales:write"), validate(quoteSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createQuote(req.companyId, req.userId, req.body));
}));

salesRouter.get("/quotes/:id", rbac("sales:read"), asyncHandler(async (req, res) => {
  res.json(await getQuote(req.companyId, req.params.id));
}));

salesRouter.patch("/quotes/:id", rbac("sales:write"), validate(quoteUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateQuote(req.companyId, req.userId, req.params.id, req.body));
}));

salesRouter.post("/quotes/:id/convert", rbac("sales:write"), asyncHandler(async (req, res) => {
  res.status(201).json(await convertQuote(req.companyId, req.userId, req.params.id));
}));

salesRouter.get("/orders", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listOrders(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      customerId: typeof req.query.customerId === "string" ? req.query.customerId : undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/orders", rbac("sales:write"), validate(orderCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createOrder(req.companyId, req.userId, req.body));
}));

salesRouter.get("/orders/:id", rbac("sales:read"), asyncHandler(async (req, res) => {
  res.json(await getOrder(req.companyId, req.params.id));
}));

salesRouter.patch("/orders/:id/status", rbac("sales:write"), validate(orderStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateOrderStatus(req.companyId, req.userId, req.params.id, req.body.status));
}));

salesRouter.post("/orders/:id/payments", rbac("sales:write"), validate(paymentCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createPayment(req.companyId, req.userId, req.params.id, req.body));
}));

salesRouter.get("/shipments", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listShipments(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      orderId: typeof req.query.orderId === "string" ? req.query.orderId : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/shipments", rbac("sales:write"), validate(shipmentSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createShipment(req.companyId, req.userId, req.body));
}));

salesRouter.patch("/shipments/:id/status", rbac("sales:write"), validate(shipmentStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateShipmentStatus(req.companyId, req.userId, req.params.id, req.body));
}));

salesRouter.get("/rmas", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listRmas(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      orderId: typeof req.query.orderId === "string" ? req.query.orderId : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/rmas", rbac("sales:write"), validate(rmaSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createRma(req.companyId, req.userId, req.body));
}));

salesRouter.patch("/rmas/:id/status", rbac("sales:write"), validate(rmaStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateRmaStatus(req.companyId, req.userId, req.params.id, req.body.status));
}));

salesRouter.get("/recurring-invoices", rbac("sales:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listRecurringInvoices(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      customerId: typeof req.query.customerId === "string" ? req.query.customerId : undefined,
      page,
      pageSize,
    }),
  );
}));

salesRouter.post("/recurring-invoices", rbac("sales:write"), validate(recurringInvoiceSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createRecurringInvoice(req.companyId, req.userId, req.body));
}));

salesRouter.patch("/recurring-invoices/:id/status", rbac("sales:write"), validate(recurringStatusSchema), asyncHandler(async (req, res) => {
  res.json(await updateRecurringStatus(req.companyId, req.userId, req.params.id, req.body.status));
}));