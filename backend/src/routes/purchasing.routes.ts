import { Router } from "express";
import { approveSchema, purchaseOrderSchema, purchaseOrderUpdateSchema, supplierSchema, supplierUpdateSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
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

purchasingRouter.use(auth, company);

purchasingRouter.get("/suppliers", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listSuppliers(req.companyId, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      isActive: typeof req.query.isActive === "string" ? req.query.isActive : undefined,
      page,
      pageSize,
    }),
  );
}));

purchasingRouter.post("/suppliers", rbac("purchasing:create"), validate(supplierSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createSupplier(req.companyId, req.userId, req.body));
}));

purchasingRouter.patch("/suppliers/:id", rbac("purchasing:write"), validate(supplierUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateSupplier(req.companyId, req.userId, req.params.id, req.body));
}));

purchasingRouter.delete("/suppliers/:id", rbac("purchasing:delete"), asyncHandler(async (req, res) => {
  await deleteSupplier(req.companyId, req.userId, req.params.id);
  res.json({ ok: true });
}));

purchasingRouter.get("/purchase-orders", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listPurchaseOrders(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      supplierId: typeof req.query.supplierId === "string" ? req.query.supplierId : undefined,
      page,
      pageSize,
    }),
  );
}));

purchasingRouter.post("/purchase-orders", rbac("purchasing:create"), validate(purchaseOrderSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createPurchaseOrder(req.companyId, req.userId, req.body));
}));

purchasingRouter.get("/purchase-orders/:id", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  res.json(await getPurchaseOrder(req.companyId, req.params.id));
}));

purchasingRouter.patch("/purchase-orders/:id", rbac("purchasing:write"), validate(purchaseOrderUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updatePurchaseOrder(req.companyId, req.userId, req.params.id, req.body));
}));

purchasingRouter.post("/purchase-orders/:id/approve", rbac("purchasing:write"), validate(approveSchema), asyncHandler(async (req, res) => {
  res.json(await approvePurchaseOrder(req.companyId, req.userId, req.params.id, req.body));
}));

purchasingRouter.post("/purchase-orders/:id/receive", rbac("purchasing:write"), asyncHandler(async (req, res) => {
  res.json(await receivePurchaseOrder(req.companyId, req.userId, req.params.id));
}));

purchasingRouter.get("/approval-requests", rbac("purchasing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listApprovalRequests(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));