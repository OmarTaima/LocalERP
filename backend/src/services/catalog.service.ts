import type { Paginated, Product } from "@erp/shared";
import { AppError } from "../utils/errors";
import { writeAudit, diff } from "./audit.service";
import { publish } from "../events/bus";
import {
  CategoryModel,
  ProductModel,
  PriceListModel,
  PriceListItemModel,
  TaxRuleModel,
  ReorderRuleModel,
  type CategoryDoc,
} from "../models";
import { serializeCategory, serializeProduct } from "../utils/serializers";

export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildCategoryTree(docs: CategoryDoc[]): Array<Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const doc of docs) {
    byId.set(doc._id.toString(), { ...serializeCategory(doc), children: [] });
  }
  const roots: Array<Record<string, unknown>> = [];
  for (const doc of docs) {
    const node = byId.get(doc._id.toString())!;
    const parent = doc.parentId ? byId.get(doc.parentId.toString()) : null;
    if (parent) {
      (parent.children as unknown[]).push(node);
    } else {
      roots.push(node);
    }
  }
  return roots.sort((a, b) => (a.order as number) - (b.order as number));
}

export async function listCategories(tenantId: string) {
  const docs = await CategoryModel.find({ tenantId }).sort({ order: 1, name: 1 }).lean();
  return buildCategoryTree(docs);
}

export async function createCategory(
  tenantId: string,
  userId: string,
  input: { name: string; slug?: string; parentId?: string | null; order?: number },
) {
  if (input.parentId) {
    const parent = await CategoryModel.findOne({ _id: input.parentId, tenantId });
    if (!parent) throw new AppError(400, "parent category does not exist");
  }
  const doc = await CategoryModel.create({
    tenantId,
    name: input.name,
    slug: input.slug ?? slugifyName(input.name),
    parentId: input.parentId ?? null,
    order: input.order ?? 0,
  });
  const after = serializeCategory(doc);
  await writeAudit({ tenantId, userId, action: "create", entity: "Category", entityId: doc._id.toString(), after });
  return after;
}

export async function updateCategory(
  tenantId: string,
  userId: string,
  categoryId: string,
  input: { name?: string; slug?: string; parentId?: string | null; order?: number },
) {
  const doc = await CategoryModel.findOne({ _id: categoryId, tenantId });
  if (!doc) throw new AppError(404, "category not found");
  if (input.parentId && input.parentId === categoryId) {
    throw new AppError(400, "category cannot be its own parent");
  }
  const before = serializeCategory(doc);
  if (typeof input.name === "string") doc.name = input.name;
  if (typeof input.slug === "string") doc.slug = input.slug;
  if (typeof input.order === "number") doc.order = input.order;
  if (input.parentId !== undefined) {
    if (input.parentId === null) {
      doc.parentId = null;
    } else if (input.parentId !== categoryId) {
      const parent = await CategoryModel.findOne({ _id: input.parentId, tenantId });
      if (!parent) throw new AppError(400, "parent category does not exist");
      doc.parentId = parent._id;
    }
  }
  await doc.save();
  const after = serializeCategory(doc);
  await writeAudit({ tenantId, userId, action: "update", entity: "Category", entityId: categoryId, before, after });
  return after;
}

export async function deleteCategory(tenantId: string, userId: string, categoryId: string): Promise<void> {
  const doc = await CategoryModel.findOne({ _id: categoryId, tenantId });
  if (!doc) throw new AppError(404, "category not found");
  const children = await CategoryModel.countDocuments({ tenantId, parentId: doc._id });
  if (children > 0) throw new AppError(400, "category has subcategories");
  const products = await ProductModel.countDocuments({ tenantId, categoryId: doc._id });
  if (products > 0) throw new AppError(400, "category has products");
  await writeAudit({ tenantId, userId, action: "delete", entity: "Category", entityId: categoryId, before: { name: doc.name } });
  await doc.deleteOne();
}

export type ProductListQuery = {
  search?: string;
  categoryId?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

const PRODUCT_SORT_WHITELIST = ["name", "sku", "price", "cost", "createdAt"];

export async function listProducts(tenantId: string, query: ProductListQuery): Promise<Paginated<Product>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const filter: Record<string, unknown> = { tenantId };
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.status === "active") filter.isActive = true;
  if (query.status === "inactive") filter.isActive = false;
  if (query.search) {
    filter.$or = [
      { name: new RegExp(query.search, "i") },
      { sku: new RegExp(query.search, "i") },
      { barcode: new RegExp(query.search, "i") },
    ];
  }
  const sortField = PRODUCT_SORT_WHITELIST.includes(query.sortBy ?? "") ? query.sortBy! : "createdAt";
  const sortDir = query.sortDir === "asc" ? 1 : -1;
  const [docs, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  return { items: docs.map(serializeProduct), total, page, pageSize };
}

export async function getProduct(tenantId: string, productId: string) {
  const doc = await ProductModel.findOne({ _id: productId, tenantId }).lean();
  if (!doc) throw new AppError(404, "product not found");
  return serializeProduct(doc);
}

export type ProductInput = {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  brand?: string;
  price: number;
  cost: number;
  barcode?: string;
  lowStockThreshold?: number;
  images?: string[];
  isActive?: boolean;
  variants?: Array<{
    name: string;
    options: string[];
    sku: string;
    price?: number;
    cost?: number;
    barcode?: string;
  }>;
};

export async function createProduct(tenantId: string, userId: string, input: ProductInput) {
  if (input.categoryId) {
    const category = await CategoryModel.exists({ _id: input.categoryId, tenantId });
    if (!category) throw new AppError(400, "category does not exist");
  }
  const duplicate = await ProductModel.exists({ tenantId, sku: input.sku });
  if (duplicate) throw new AppError(409, "sku already exists");
  const doc = await ProductModel.create({
    tenantId,
    sku: input.sku,
    name: input.name,
    description: input.description ?? "",
    categoryId: input.categoryId ?? null,
    brand: input.brand ?? "",
    price: input.price,
    cost: input.cost,
    barcode: input.barcode ?? "",
    lowStockThreshold: input.lowStockThreshold ?? 5,
    images: input.images ?? [],
    variants: input.variants ?? [],
    version: 1,
  });
  const after = serializeProduct(doc);
  await writeAudit({ tenantId, userId, action: "create", entity: "Product", entityId: doc._id.toString(), after });
  publish({ type: "catalog.product.created", payload: { tenantId, productId: doc._id.toString() } });
  return after;
}

export async function updateProduct(
  tenantId: string,
  userId: string,
  productId: string,
  input: Partial<ProductInput> & { version?: number },
) {
  const doc = await ProductModel.findOne({ _id: productId, tenantId });
  if (!doc) throw new AppError(404, "product not found");
  if (input.version !== undefined) {
    if (input.version !== doc.version) throw new AppError(409, "product was modified concurrently");
  }
  if (input.sku !== undefined && input.sku !== doc.sku) {
    const duplicate = await ProductModel.exists({ tenantId, sku: input.sku, _id: { $ne: doc._id } });
    if (duplicate) throw new AppError(409, "sku already exists");
  }
  if (input.categoryId !== undefined && input.categoryId !== null) {
    const category = await CategoryModel.exists({ _id: input.categoryId, tenantId });
    if (!category) throw new AppError(400, "category does not exist");
  }
  const before = serializeProduct(doc);
  if (input.sku !== undefined) doc.sku = input.sku;
  if (input.name !== undefined) doc.name = input.name;
  if (input.description !== undefined) doc.description = input.description;
  if (input.categoryId !== undefined) doc.categoryId = input.categoryId ? (input.categoryId as unknown as typeof doc.categoryId) : null;
  if (input.brand !== undefined) doc.brand = input.brand;
  if (input.price !== undefined) doc.price = input.price;
  if (input.cost !== undefined) doc.cost = input.cost;
  if (input.barcode !== undefined) doc.barcode = input.barcode;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.lowStockThreshold !== undefined) doc.lowStockThreshold = input.lowStockThreshold;
  if (input.images !== undefined) doc.images = input.images;
  if (input.variants !== undefined) doc.variants = input.variants;
  doc.version += 1;
  await doc.save();
  const after = serializeProduct(doc);
  await writeAudit({
    tenantId,
    userId,
    action: "update",
    entity: "Product",
    entityId: productId,
    ...diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>),
  });
  publish({ type: "catalog.product.updated", payload: { tenantId, productId } });
  return after;
}

export async function deactivateProduct(tenantId: string, userId: string, productId: string): Promise<void> {
  const doc = await ProductModel.findOne({ _id: productId, tenantId });
  if (!doc) throw new AppError(404, "product not found");
  const before = serializeProduct(doc);
  doc.isActive = false;
  doc.version += 1;
  await doc.save();
  await writeAudit({
    tenantId,
    userId,
    action: "delete",
    entity: "Product",
    entityId: productId,
    before: { isActive: before.isActive },
    after: { isActive: false },
  });
}

export async function listPriceLists(tenantId: string) {
  const lists = await PriceListModel.find({ tenantId }).sort({ isDefault: -1, name: 1 }).lean();
  return Promise.all(
    lists.map(async (list) => ({
      id: list._id.toString(),
      name: list.name,
      customerSegmentIds: list.customerSegmentIds.map((id) => id.toString()),
      isDefault: list.isDefault,
      items: await PriceListItemModel.countDocuments({ tenantId, priceListId: list._id }),
    })),
  );
}

export async function createPriceList(
  tenantId: string,
  userId: string,
  input: { name: string; customerSegmentIds?: string[]; isDefault?: boolean },
) {
  const doc = await PriceListModel.create({
    tenantId,
    name: input.name,
    customerSegmentIds: input.customerSegmentIds ?? [],
    isDefault: input.isDefault ?? false,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "PriceList", entityId: doc._id.toString(), after: { name: doc.name } });
  return { id: doc._id.toString(), name: doc.name };
}

export async function setPriceListItems(
  tenantId: string,
  userId: string,
  priceListId: string,
  items: Array<{ productId: string; price: number; minQuantity?: number }>,
) {
  const list = await PriceListModel.findOne({ _id: priceListId, tenantId });
  if (!list) throw new AppError(404, "price list not found");
  for (const item of items) {
    const product = await ProductModel.exists({ _id: item.productId, tenantId });
    if (!product) throw new AppError(400, `product ${item.productId} does not exist`);
  }
  const existing = await PriceListItemModel.find({ tenantId, priceListId: list._id }).lean();
  const existingMap = new Map(existing.map((doc) => [doc.productId.toString(), doc]));
  await PriceListItemModel.bulkWrite(
    items.map((item) => {
      const current = existingMap.get(item.productId);
      if (current) {
        return {
          updateOne: {
            filter: { _id: current._id },
            update: { price: item.price, minQuantity: item.minQuantity ?? 1 },
          },
        };
      }
      return {
        insertOne: {
          document: { tenantId, priceListId: list._id, productId: item.productId, price: item.price, minQuantity: item.minQuantity ?? 1 },
        },
      };
    }),
  );
  await writeAudit({
    tenantId,
    userId,
    action: "update",
    entity: "PriceList",
    entityId: priceListId,
    after: { items: items.length },
  });
  return { updated: items.length };
}

export async function listTaxRules(tenantId: string) {
  return TaxRuleModel.find({ tenantId }).sort({ name: 1 }).lean();
}

export async function createTaxRule(
  tenantId: string,
  userId: string,
  input: { name: string; rate: number; appliesTo: "product" | "category" | "region"; region?: string | null; categoryId?: string | null; isActive?: boolean },
) {
  const doc = await TaxRuleModel.create({
    tenantId,
    name: input.name,
    rate: input.rate,
    appliesTo: input.appliesTo,
    region: input.region ?? null,
    categoryId: input.categoryId ?? null,
    isActive: input.isActive ?? true,
  });
  await writeAudit({ tenantId, userId, action: "create", entity: "TaxRule", entityId: doc._id.toString(), after: { name: doc.name, rate: doc.rate } });
  return { id: doc._id.toString(), name: doc.name, rate: doc.rate };
}

export async function updateTaxRule(
  tenantId: string,
  userId: string,
  taxRuleId: string,
  input: Partial<{ rate: number; name: string; isActive: boolean }>,
) {
  const doc = await TaxRuleModel.findOne({ _id: taxRuleId, tenantId });
  if (!doc) throw new AppError(404, "tax rule not found");
  const before = { name: doc.name, rate: doc.rate, isActive: doc.isActive };
  if (input.name !== undefined) doc.name = input.name;
  if (input.rate !== undefined) doc.rate = input.rate;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  await writeAudit({ tenantId, userId, action: "update", entity: "TaxRule", entityId: taxRuleId, before, after: { name: doc.name, rate: doc.rate, isActive: doc.isActive } });
  return { id: doc._id.toString(), name: doc.name, rate: doc.rate, isActive: doc.isActive };
}

export async function deleteTaxRule(tenantId: string, userId: string, taxRuleId: string): Promise<void> {
  const doc = await TaxRuleModel.findOne({ _id: taxRuleId, tenantId });
  if (!doc) throw new AppError(404, "tax rule not found");
  await writeAudit({ tenantId, userId, action: "delete", entity: "TaxRule", entityId: taxRuleId, before: { name: doc.name } });
  await doc.deleteOne();
}

export async function listReorderRules(tenantId: string) {
  return ReorderRuleModel.find({ tenantId }).sort({ productId: 1 }).lean();
}

export async function upsertReorderRule(
  tenantId: string,
  userId: string,
  input: { productId: string; warehouseId: string; minQuantity: number; maxQuantity: number; enabled?: boolean },
) {
  const product = await ProductModel.exists({ _id: input.productId, tenantId });
  if (!product) throw new AppError(400, "product does not exist");
  const doc = await ReorderRuleModel.findOneAndUpdate(
    { tenantId, productId: input.productId, warehouseId: input.warehouseId },
    { minQuantity: input.minQuantity, maxQuantity: input.maxQuantity, enabled: input.enabled ?? true },
    { new: true, upsert: true },
  );
  await writeAudit({
    tenantId,
    userId,
    action: "create",
    entity: "ReorderRule",
    entityId: doc._id.toString(),
    after: { productId: input.productId, minQuantity: doc.minQuantity, maxQuantity: doc.maxQuantity },
  });
  return { id: doc._id.toString(), productId: doc.productId.toString(), minQuantity: doc.minQuantity, maxQuantity: doc.maxQuantity };
}

export async function deleteReorderRule(tenantId: string, userId: string, ruleId: string): Promise<void> {
  const doc = await ReorderRuleModel.findOne({ _id: ruleId, tenantId });
  if (!doc) throw new AppError(404, "reorder rule not found");
  await writeAudit({ tenantId, userId, action: "delete", entity: "ReorderRule", entityId: ruleId, before: { productId: doc.productId.toString() } });
  await doc.deleteOne();
}