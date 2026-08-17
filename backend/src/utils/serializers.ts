import type { Category, Company, Product } from "@erp/shared";
import type { CategoryDoc } from "../models/category";
import type { CompanyDoc } from "../models/company";
import type { ProductDoc } from "../models/product";

export function serializeCompany(doc: CompanyDoc): Company {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    plan: doc.plan,
    isActive: doc.isActive,
    logoUrl: doc.logoUrl ?? null,
    settings: doc.settings,
    limits: doc.limits,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeCategory(doc: CategoryDoc): Category {
  return {
    id: doc._id.toString(),
    companyId: doc.companyId.toString(),
    name: doc.name,
    slug: doc.slug,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    order: doc.order,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeProduct(doc: ProductDoc): Product {
  return {
    id: doc._id.toString(),
    companyId: doc.companyId.toString(),
    sku: doc.sku,
    name: doc.name,
    description: doc.description,
    categoryId: doc.categoryId ? doc.categoryId.toString() : null,
    brand: doc.brand,
    price: doc.price,
    cost: doc.cost,
    barcode: doc.barcode,
    isActive: doc.isActive,
    lowStockThreshold: doc.lowStockThreshold,
    images: doc.images,
    variants: doc.variants,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}