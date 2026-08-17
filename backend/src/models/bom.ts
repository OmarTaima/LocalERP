import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Bom } from "@erp/shared";

export type BomDoc = Omit<Bom, "id" | "companyId" | "productId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const bomSchema = new Schema<BomDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    components: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
          quantity: { type: Number, required: true, min: 0 },
        },
      ],
      required: true,
    },
    outputQuantity: { type: Number, default: 1 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

bomSchema.index({ companyId: 1, productId: 1 }, { unique: true });

export const BomModel: Model<BomDoc> = (mongoose.models.Bom as Model<BomDoc>) || mongoose.model<BomDoc>("Bom", bomSchema);