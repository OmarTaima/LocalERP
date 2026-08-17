import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Category } from "@erp/shared";

export type CategoryDoc = Omit<Category, "id" | "tenantId" | "parentId"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const categorySchema = new Schema<CategoryDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

categorySchema.index({ tenantId: 1, parentId: 1 });
categorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const CategoryModel: Model<CategoryDoc> =
  (mongoose.models.Category as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("Category", categorySchema);