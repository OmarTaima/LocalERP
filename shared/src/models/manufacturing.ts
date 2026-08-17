import type { ID, Money, CompanyScoped, Timestamps } from "./common";

export type BomComponent = {
  productId: ID;
  quantity: number;
};

export type Bom = Timestamps &
  CompanyScoped & {
    id: ID;
    productId: ID;
    components: BomComponent[];
    outputQuantity: number;
    version: number;
  };

export type WorkCenter = Timestamps &
  CompanyScoped & {
    id: ID;
    name: string;
    costPerHour: Money;
    capacity: number;
    isActive: boolean;
  };

export const WORK_ORDER_STATUSES = ["draft", "released", "in-progress", "completed", "cancelled"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type ConsumedMaterial = {
  productId: ID;
  quantity: number;
  batchId?: ID;
};

export type FinishedGood = {
  batchId: ID;
  quantity: number;
};

export type WorkOrder = Timestamps &
  CompanyScoped & {
    id: ID;
    woNumber: string;
    bomId: ID;
    productId: ID;
    quantity: number;
    workCenterId: ID;
    plannedHours: number;
    status: WorkOrderStatus;
    materialConsumed: ConsumedMaterial[];
    finishedGoods: FinishedGood[];
    unitCost: Money;
    startedAt: string | null;
    completedAt: string | null;
  };

export const MRP_TYPES = ["purchase", "produce"] as const;
export type MrpType = (typeof MRP_TYPES)[number];

export const MRP_STATUSES = ["open", "actioned", "dismissed"] as const;
export type MrpStatus = (typeof MRP_STATUSES)[number];

export type MrpSuggestion = Timestamps &
  CompanyScoped & {
    id: ID;
    productId: ID;
    warehouseId: ID;
    type: MrpType;
    suggestedQuantity: number;
    reason: string;
    status: MrpStatus;
  };