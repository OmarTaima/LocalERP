import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Product } from "@erp/shared";

export type ProductDoc = Omit<Product, "id" | "companyId" | "categoryId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const productSchema = new Schema<ProductDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    brand: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    barcode: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    images: { type: [String], default: [] },
    variants: {
      type: [
        {
          name: { type: String, required: true },
          options: { type: [String], required: true },
          sku: { type: String, required: true },
          price: { type: Number },
          cost: { type: Number },
          barcode: { type: String },
        },
      ],
      default: [],
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, categoryId: 1 });
productSchema.index({ companyId: 1, isActive: 1, lowStockThreshold: 1 });
productSchema.index({ companyId: 1, name: "text", description: "text" });

export const ProductModel: Model<ProductDoc> =
  (mongoose.models.Product as Model<ProductDoc>) || mongoose.model<ProductDoc>("Product", productSchema);