import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { PriceList, PriceListItem } from "@erp/shared";

const { Schema } = mongoose;

export type PriceListDoc = Omit<PriceList, "id" | "companyId" | "customerSegmentIds"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  customerSegmentIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

const priceListSchema = new Schema<PriceListDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    customerSegmentIds: { type: [Schema.Types.ObjectId], default: [] },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

priceListSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const PriceListModel: Model<PriceListDoc> =
  (mongoose.models.PriceList as Model<PriceListDoc>) || mongoose.model<PriceListDoc>("PriceList", priceListSchema);

export type PriceListItemDoc = Omit<PriceListItem, "id" | "companyId" | "priceListId" | "productId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  priceListId: Types.ObjectId;
  productId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const priceListItemSchema = new Schema<PriceListItemDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    priceListId: { type: Schema.Types.ObjectId, ref: "PriceList", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    price: { type: Number, required: true, min: 0 },
    minQuantity: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true },
);

priceListItemSchema.index({ companyId: 1, priceListId: 1, productId: 1 }, { unique: true });

export const PriceListItemModel: Model<PriceListItemDoc> =
  (mongoose.models.PriceListItem as Model<PriceListItemDoc>) ||
  mongoose.model<PriceListItemDoc>("PriceListItem", priceListItemSchema);