import { Router } from "express";
import {
  categorySchema,
  priceListItemBulkSchema,
  priceListSchema,
  productCreateSchema,
  productUpdateSchema,
  reorderRuleSchema,
  stockAdjustSchema,
  taxRuleSchema,
} from "@erp/shared";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { parseDateRange, parsePagination } from "../utils/pagination";
import {
  createCategory,
  createPriceList,
  createProduct,
  createTaxRule,
  deleteCategory,
  deleteReorderRule,
  deleteTaxRule,
  deactivateProduct,
  getProduct,
  listCategories,
  listPriceLists,
  listProducts,
  listReorderRules,
  listTaxRules,
  setPriceListItems,
  updateCategory,
  updateProduct,
  updateTaxRule,
  upsertReorderRule,
} from "../services/catalog.service";
import { adjustStock, listMovements } from "../services/inventory.service";

export const catalogRouter = Router();

catalogRouter.use(auth, tenant);

catalogRouter.get("/categories", rbac("catalog:read"), asyncHandler(async (req, res) => {
  res.json(await listCategories(req.tenantId));
}));

catalogRouter.post("/categories", rbac("catalog:write"), validate(categorySchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createCategory(req.tenantId, req.userId, req.body));
}));

catalogRouter.patch("/categories/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  res.json(await updateCategory(req.tenantId, req.userId, req.params.id, req.body));
}));

catalogRouter.delete("/categories/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  await deleteCategory(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));

catalogRouter.get("/products", rbac("catalog:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const products = await listProducts(req.tenantId, {
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
    status: typeof req.query.status === "string" ? (req.query.status as "active" | "inactive" | "all") : undefined,
    page,
    pageSize,
    sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
    sortDir: req.query.sortDir === "asc" ? "asc" : req.query.sortDir === "desc" ? "desc" : undefined,
  });
  res.json(products);
}));

catalogRouter.post("/products", rbac("catalog:write"), validate(productCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createProduct(req.tenantId, req.userId, req.body));
}));

catalogRouter.get("/products/:id", rbac("catalog:read"), asyncHandler(async (req, res) => {
  res.json(await getProduct(req.tenantId, req.params.id));
}));

catalogRouter.patch("/products/:id", rbac("catalog:write"), validate(productUpdateSchema), asyncHandler(async (req, res) => {
  res.json(await updateProduct(req.tenantId, req.userId, req.params.id, req.body));
}));

catalogRouter.delete("/products/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  await deactivateProduct(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));

catalogRouter.get("/products/:id/movements", rbac("inventory:read"), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const { from, to } = parseDateRange(req.query);
  res.json(
    await listMovements(req.tenantId, req.params.id, {
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      page,
      pageSize,
    }),
  );
}));

catalogRouter.post("/products/:id/stock-adjust", rbac("inventory:write"), validate(stockAdjustSchema), asyncHandler(async (req, res) => {
  res.json(await adjustStock(req.tenantId, req.userId, req.params.id, req.body));
}));

catalogRouter.get("/price-lists", rbac("catalog:read"), asyncHandler(async (req, res) => {
  res.json(await listPriceLists(req.tenantId));
}));

catalogRouter.post("/price-lists", rbac("catalog:write"), validate(priceListSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createPriceList(req.tenantId, req.userId, req.body));
}));

catalogRouter.patch("/price-lists/:id/items", rbac("catalog:write"), validate(priceListItemBulkSchema), asyncHandler(async (req, res) => {
  res.json(await setPriceListItems(req.tenantId, req.userId, req.params.id, req.body.items));
}));

catalogRouter.get("/tax-rules", rbac("catalog:read"), asyncHandler(async (req, res) => {
  const docs = await listTaxRules(req.tenantId);
  res.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      rate: doc.rate,
      appliesTo: doc.appliesTo,
      region: doc.region,
      categoryId: doc.categoryId ? doc.categoryId.toString() : null,
      isActive: doc.isActive,
    })),
  );
}));

catalogRouter.post("/tax-rules", rbac("catalog:write"), validate(taxRuleSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await createTaxRule(req.tenantId, req.userId, req.body));
}));

catalogRouter.patch("/tax-rules/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  res.json(await updateTaxRule(req.tenantId, req.userId, req.params.id, req.body));
}));

catalogRouter.delete("/tax-rules/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  await deleteTaxRule(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));

catalogRouter.get("/reorder-rules", rbac("catalog:read"), asyncHandler(async (req, res) => {
  const docs = await listReorderRules(req.tenantId);
  res.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      productId: doc.productId.toString(),
      warehouseId: doc.warehouseId.toString(),
      minQuantity: doc.minQuantity,
      maxQuantity: doc.maxQuantity,
      enabled: doc.enabled,
    })),
  );
}));

catalogRouter.post("/reorder-rules", rbac("catalog:write"), validate(reorderRuleSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await upsertReorderRule(req.tenantId, req.userId, req.body));
}));

catalogRouter.delete("/reorder-rules/:id", rbac("catalog:write"), asyncHandler(async (req, res) => {
  await deleteReorderRule(req.tenantId, req.userId, req.params.id);
  res.json({ ok: true });
}));