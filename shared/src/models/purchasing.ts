import type { ID, Money, TenantScoped, Timestamps } from "./common";

export type Supplier = Timestamps &
  TenantScoped & {
    id: ID;
    name: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    paymentTerms: string;
    isActive: boolean;
  };

export type PoLine = {
  productId: ID;
  quantity: number;
  unitCost: Money;
  batchId?: ID;
};

export type Grn = {
  grnNumber: string;
  receivedAt: string;
  items: PoLine[];
};

export const PO_STATUSES = [
  "draft",
  "pending-approval",
  "sent",
  "partial",
  "received",
  "closed",
  "rejected",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export type PurchaseOrder = Timestamps &
  TenantScoped & {
    id: ID;
    poNumber: string;
    supplierId: ID;
    items: PoLine[];
    expectedDate: string;
    status: PoStatus;
    approvalId: ID | null;
    grns: Grn[];
    version: number;
  };

export type ApprovalRequest = Timestamps &
  TenantScoped & {
    id: ID;
    entityType: "purchase-order" | "expense-claim" | "leave";
    entityId: ID;
    amount: Money;
    requestedBy: ID;
    chain: ID[];
    currentStep: number;
    status: "pending" | "approved" | "rejected";
    decisions: Array<{ approverId: ID; approved: boolean; note: string; at: string }>;
  };