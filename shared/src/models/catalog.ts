import type { ID, Money, TenantScoped, Timestamps } from "./common";

export type Category = Timestamps &
  TenantScoped & {
    id: ID;
    name: string;
    slug: string;
    parentId: ID | null;
    order: number;
  };

export type ProductVariant = {
  name: string;
  options: string[];
  sku: string;
  price?: Money;
  cost?: Money;
  barcode?: string;
};

export type Product = Timestamps &
  TenantScoped & {
    id: ID;
    sku: string;
    name: string;
    description: string;
    categoryId: ID | null;
    brand: string;
    price: Money;
    cost: Money;
    barcode: string;
    isActive: boolean;
    lowStockThreshold: number;
    images: string[];
    variants: ProductVariant[];
    version: number;
  };

export type Batch = Timestamps &
  TenantScoped & {
    id: ID;
    productId: ID;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
    supplierId: ID | null;
    receivedAt: string;
  };

export type PriceList = Timestamps &
  TenantScoped & {
    id: ID;
    name: string;
    customerSegmentIds: ID[];
    isDefault: boolean;
  };

export type PriceListItem = Timestamps &
  TenantScoped & {
    id: ID;
    priceListId: ID;
    productId: ID;
    price: Money;
    minQuantity: number;
  };

export type TaxAppliesTo = "product" | "category" | "region";

export type TaxRule = Timestamps &
  TenantScoped & {
    id: ID;
    name: string;
    rate: number;
    appliesTo: TaxAppliesTo;
    region: string | null;
    categoryId: ID | null;
    isActive: boolean;
  };

export type ReorderRule = Timestamps &
  TenantScoped & {
    id: ID;
    productId: ID;
    warehouseId: ID;
    minQuantity: number;
    maxQuantity: number;
    enabled: boolean;
  };