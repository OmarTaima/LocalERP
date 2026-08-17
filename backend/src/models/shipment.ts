import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Shipment } from "@erp/shared";

export type ShipmentDoc = Omit<Shipment, "id" | "companyId" | "orderId" | "shippedAt" | "deliveredAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  orderId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

const { Schema } = mongoose;

const shipmentSchema = new Schema<ShipmentDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "SalesOrder", required: true },
    carrier: { type: String, required: true },
    trackingNumber: { type: String, default: "" },
    pickList: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 1 },
          fromWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
        },
      ],
      required: true,
    },
    status: { type: String, enum: ["draft", "packed", "shipped", "delivered"], default: "draft" },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shipmentSchema.index({ companyId: 1, orderId: 1 });
shipmentSchema.index({ companyId: 1, status: 1, createdAt: -1 });

export const ShipmentModel: Model<ShipmentDoc> =
  (mongoose.models.Shipment as Model<ShipmentDoc>) || mongoose.model<ShipmentDoc>("Shipment", shipmentSchema);