import type { ID, TenantScoped, Timestamps } from "./common";

export type Warehouse = Timestamps &
  TenantScoped & {
    id: ID;
    name: string;
    address: string;
    isDefault: boolean;
    isActive: boolean;
  };

export type Inventory = Timestamps &
  TenantScoped & {
    id: ID;
    productId: ID;
    warehouseId: ID;
    quantity: number;
    version: number;
  };

export const MOVEMENT_TYPES = [
  "sold",
  "received",
  "adjusted",
  "transferred",
  "returned",
  "consumed",
  "produced",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type StockMovement = Timestamps &
  TenantScoped & {
    id: ID;
    productId: ID;
    warehouseId: ID;
    batchId: ID | null;
    quantity: number;
    type: MovementType;
    referenceId: ID;
    note: string;
    userId: ID;
  };

export const TRANSFER_STATUSES = ["draft", "in-transit", "received", "cancelled"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export type TransferItem = {
  productId: ID;
  quantity: number;
  batchId?: ID;
};

export type Transfer = Timestamps &
  TenantScoped & {
    id: ID;
    fromWarehouseId: ID;
    toWarehouseId: ID;
    items: TransferItem[];
    status: TransferStatus;
    referenceNumber: string;
    version: number;
  };