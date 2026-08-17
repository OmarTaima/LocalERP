import type { ID, Money, OrderLine, OrderStatus, OrderTotals, TenantScoped, Timestamps } from "./common";

export type CustomerAddress = {
  label: string;
  street: string;
  city: string;
  country: string;
};

export type Customer = Timestamps &
  TenantScoped & {
    id: ID;
    email: string;
    name: string;
    phone: string;
    addresses: CustomerAddress[];
    segmentId: ID | null;
    creditLimit: Money;
    tags: string[];
    notes: string;
    totalSpent: Money;
    status: "active" | "inactive";
  };

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type Quote = Timestamps &
  TenantScoped & {
    id: ID;
    quoteNumber: string;
    customerId: ID;
    items: OrderLine[];
    totals: OrderTotals;
    status: QuoteStatus;
    validUntil: string;
    version: number;
  };

export type SalesOrder = Timestamps &
  TenantScoped & {
    id: ID;
    orderNumber: string;
    customerId: ID;
    quoteId: ID | null;
    items: OrderLine[];
    totals: OrderTotals;
    status: OrderStatus;
    shippingAddress: CustomerAddress;
    notes: string;
    idempotencyKey: string;
    version: number;
  };

export const PAYMENT_METHODS = ["card", "transfer", "cash", "refund"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["pending", "captured", "failed", "reversed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Payment = Timestamps &
  TenantScoped & {
    id: ID;
    orderId: ID;
    amount: Money;
    method: PaymentMethod;
    status: PaymentStatus;
    reference: string;
    idempotencyKey: string;
    paidAt: string;
  };

export const SHIPMENT_STATUSES = ["draft", "packed", "shipped", "delivered"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export type PickLine = {
  productId: ID;
  quantity: number;
  fromWarehouseId: ID;
};

export type Shipment = Timestamps &
  TenantScoped & {
    id: ID;
    orderId: ID;
    carrier: string;
    trackingNumber: string;
    pickList: PickLine[];
    status: ShipmentStatus;
    shippedAt: string | null;
    deliveredAt: string | null;
  };

export const RMA_STATUSES = ["requested", "approved", "received", "refunded", "rejected"] as const;
export type RmaStatus = (typeof RMA_STATUSES)[number];

export type RmaItem = {
  productId: ID;
  quantity: number;
  batchId?: ID;
  condition: string;
};

export type Rma = Timestamps &
  TenantScoped & {
    id: ID;
    rmaNumber: string;
    orderId: ID;
    items: RmaItem[];
    reason: string;
    status: RmaStatus;
    restockedAt: string | null;
  };

export const RECURRING_INTERVALS = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurringInterval = (typeof RECURRING_INTERVALS)[number];

export type RecurringLine = {
  productId?: ID;
  name: string;
  quantity: number;
  unitPrice: Money;
};

export type RecurringInvoice = Timestamps &
  TenantScoped & {
    id: ID;
    customerId: ID;
    items: RecurringLine[];
    interval: RecurringInterval;
    nextRunAt: string;
    status: "active" | "paused" | "cancelled";
    dayOfPeriod: number;
  };