import { Router } from "express";
import { bomSchema, bomUpdateSchema, mrpActionSchema, workCenterSchema, workCenterUpdateSchema, workOrderSchema } from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { company } from "../middleware/company";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parsePagination } from "../utils/pagination";
import {
  actionMrpSuggestion,
  cancelWorkOrder,
  completeWorkOrder,
  createBom,
  createWorkCenter,
  createWorkOrder,
  deleteBom,
  generateMrpSuggestions,
  getWorkOrder,
  listBoms,
  listMrpSuggestions,
  listWorkCenters,
  listWorkOrders,
  startWorkOrder,
  updateBom,
  updateWorkCenter,
} from "../services/manufacturing.service";

export const manufacturingRouter = Router();

manufacturingRouter.use(auth, company);

manufacturingRouter.get("/boms", rbac("manufacturing:read"), asyncHandler(async (req, res) => {
  res.json(await listBoms(req.companyId));
}));

manufacturingRouter.post("/boms", rbac("manufacturing:create"), validate(bomSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createBom(req.companyId, req.userId, req.body));
}));

manufacturingRouter.patch("/boms/:id", rbac("manufacturing:write"), validate(bomUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateBom(req.companyId, req.userId, req.params.id, req.body));
}));

manufacturingRouter.delete("/boms/:id", rbac("manufacturing:delete"), asyncHandler(async (req, res) => {
  await deleteBom(req.companyId, req.userId, req.params.id);
  res.json({ ok: true });
}));

manufacturingRouter.get("/work-centers", rbac("manufacturing:read"), asyncHandler(async (req, res) => {
  res.json(await listWorkCenters(req.companyId));
}));

manufacturingRouter.post("/work-centers", rbac("manufacturing:create"), validate(workCenterSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createWorkCenter(req.companyId, req.userId, req.body));
}));

manufacturingRouter.patch("/work-centers/:id", rbac("manufacturing:write"), validate(workCenterUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateWorkCenter(req.companyId, req.userId, req.params.id, req.body));
}));

manufacturingRouter.get("/work-orders", rbac("manufacturing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listWorkOrders(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      productId: typeof req.query.productId === "string" ? req.query.productId : undefined,
      page,
      pageSize,
    }),
  );
}));

manufacturingRouter.post("/work-orders", rbac("manufacturing:create"), validate(workOrderSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createWorkOrder(req.companyId, req.userId, req.body));
}));

manufacturingRouter.get("/work-orders/:id", rbac("manufacturing:read"), asyncHandler(async (req, res) => {
  res.json(await getWorkOrder(req.companyId, req.params.id));
}));

manufacturingRouter.post("/work-orders/:id/start", rbac("manufacturing:write"), asyncHandler(async (req, res) => {
  res.json(await startWorkOrder(req.companyId, req.userId, req.params.id));
}));

manufacturingRouter.post("/work-orders/:id/receive", rbac("manufacturing:write"), asyncHandler(async (req, res) => {
  res.json(await completeWorkOrder(req.companyId, req.userId, req.params.id));
}));

manufacturingRouter.post("/work-orders/:id/cancel", rbac("manufacturing:write"), asyncHandler(async (req, res) => {
  res.json(await cancelWorkOrder(req.companyId, req.userId, req.params.id));
}));

manufacturingRouter.get("/mrp/suggestions", rbac("manufacturing:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  res.json(
    await listMrpSuggestions(req.companyId, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page,
      pageSize,
    }),
  );
}));

manufacturingRouter.post("/mrp/generate", rbac("manufacturing:write"), asyncHandler(async (req, res) => {
  res.json({ created: await generateMrpSuggestions(req.companyId) });
}));

manufacturingRouter.post("/mrp/suggestions/:id/action", rbac("manufacturing:write"), validate(mrpActionSchema), asyncHandler(async (req, res) => {
  res.json(await actionMrpSuggestion(req.companyId, req.userId, req.params.id, req.body.status));
}));