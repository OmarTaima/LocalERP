import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ImportJob } from "@erp/shared";

export type ImportJobDoc = Omit<ImportJob, "id" | "companyId" | "createdBy"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const importJobSchema = new Schema<ImportJobDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    type: { type: String, enum: ["products", "customers", "orders", "employees"], required: true },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ["queued", "processing", "done", "failed"], default: "queued" },
    result: {
      processed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      errors: { type: [String], default: [] },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

importJobSchema.index({ companyId: 1, createdAt: -1 });

export const ImportJobModel: Model<ImportJobDoc> =
  (mongoose.models.ImportJob as Model<ImportJobDoc>) || mongoose.model<ImportJobDoc>("ImportJob", importJobSchema);