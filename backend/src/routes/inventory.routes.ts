import { Router } from "express";
import { transferSchema, warehouseSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import {
  createTransfer,
  createWarehouse,
  deleteWarehouse,
  listBatches,
  listLowStock,
  listTransfers,
  listWarehouses,
  receiveTransfer,
  updateWarehouse,
} from "../services/inventory.service";

export const inventoryRouter = Router();

inventoryRouter.use(auth, company);

inventoryRouter.get("/warehouses", rbac("inventory:read"), asyncHandler(async (req, res) => {
  res.json(await listWarehouses(req.companyId));
}));

inventoryRouter.post("/warehouses", rbac("inventory:create"), validate(warehouseSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createWarehouse(req.companyId, req.userId, req.body));
}));

inventoryRouter.patch("/warehouses/:id", rbac("inventory:write"), asyncHandler(async (req, res) => {
  res.json(await updateWarehouse(req.companyId, req.userId, req.params.id, req.body));
}));

inventoryRouter.delete("/warehouses/:id", rbac("inventory:delete"), asyncHandler(async (req, res) => {
  await deleteWarehouse(req.companyId, req.userId, req.params.id);
  res.json({ ok: true });
}));

inventoryRouter.post("/warehouses/transfer", rbac("inventory:create"), validate(transferSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createTransfer(req.companyId, req.userId, req.body));
}));

inventoryRouter.get("/warehouses/transfers", rbac("inventory:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listTransfers(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

inventoryRouter.post("/warehouses/transfers/:id/receive", rbac("inventory:write"), asyncHandler(async (req, res) => {
  res.json(await receiveTransfer(req.companyId, req.userId, req.params.id));
}));

inventoryRouter.get("/inventory/low-stock", rbac("inventory:read"), asyncHandler(async (req, res) => {
  res.json(await listLowStock(req.companyId));
}));

inventoryRouter.get("/batches", rbac("inventory:read"), asyncHandler(async (req, res) => {
  res.json(
    await listBatches(req.companyId, {
      expiringWithinDays: typeof req.query.expiringWithin === "string" ? Number(req.query.expiringWithin) : undefined,
      productId: typeof req.query.productId === "string" ? req.query.productId : undefined,
    }),
  );
}));