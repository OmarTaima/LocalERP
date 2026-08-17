export type ID = string;

export type Timestamps = {
  createdAt: string;
  updatedAt: string;
};

export type TenantScoped = {
  tenantId: ID;
};

export type Money = number;

export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ErrorResponse = {
  error: string;
};

export type OrderLine = {
  productId: ID;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: Money;
  taxRate: number;
  batchId?: ID;
};

export type OrderTotals = {
  subtotal: Money;
  tax: Money;
  shipping: Money;
  discount: Money;
  total: Money;
};

export const PLAN_TIERS = ["starter", "pro", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const ORDER_STATUSES = [
  "quote",
  "draft",
  "confirmed",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];