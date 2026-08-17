import { Router } from "express";
import { approveSchema, purchaseOrderSchema, purchaseOrderUpdateSchema, supplierSchema, supplierUpdateSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  deleteSupplier,
  getPurchaseOrder,
  listApprovalRequests,
  listPurchaseOrders,
  listSuppliers,
  receivePurchaseOrder,
  updatePurchaseOrder,
  updateSupplier,
} from "../services/purchasing.service";

export const purchasingRouter = Router();

purchasingRouter.use(auth, tenant);

purchasingRouter.get("/suppliers", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listSuppliers(req.tenantId, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      isActive: typeof req.query.isActive === "string" ? req.query.isActive : undefined,
      page,
      pageSize,
    }),
  );
}));

purchasingRouter.post("/suppliers", rbac("purchasing:write"), validate(supplierSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createSupplier(req.tenantId, req.userId, req.body));
}));

purchasingRouter.patch("/suppliers/:id", rbac("purchasing:write"), validate(supplierUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateSupplier(req.tenantId, req.userId, req.params.id, req.body));
}));

purchasingRouter.delete("/suppliers/:id", rbac("purchasing:write"), asyncHandler(async (req, res) => {
  await deleteSupplier(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));

purchasingRouter.get("/purchase-orders", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listPurchaseOrders(req.tenantId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      supplierId: typeof req.query.supplierId === "string" ? req.query.supplierId : undefined,
      page,
      pageSize,
    }),
  );
}));

purchasingRouter.post("/purchase-orders", rbac("purchasing:write"), validate(purchaseOrderSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createPurchaseOrder(req.tenantId, req.userId, req.body));
}));

purchasingRouter.get("/purchase-orders/:id", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  res.json(await getPurchaseOrder(req.tenantId, req.params.id));
}));

purchasingRouter.patch("/purchase-orders/:id", rbac("purchasing:write"), validate(purchaseOrderUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updatePurchaseOrder(req.tenantId, req.userId, req.params.id, req.body));
}));

purchasingRouter.post("/purchase-orders/:id/approve", rbac("approvals:write"), validate(approveSchema), asyncHandler(async (req, res) => {
  res.json(await approvePurchaseOrder(req.tenantId, req.userId, req.params.id, req.body));
}));

purchasingRouter.post("/purchase-orders/:id/receive", rbac("purchasing:write"), asyncHandler(async (req, res) => {
  res.json(await receivePurchaseOrder(req.tenantId, req.userId, req.params.id));
}));

purchasingRouter.get("/approval-requests", rbac("approvals:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listApprovalRequests(req.tenantId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));