import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ExportJob } from "@erp/shared";

export type ExportJobDoc = Omit<ExportJob, "id" | "companyId" | "createdBy"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  fileContent: string;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const exportJobSchema = new Schema<ExportJobDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    type: { type: String, enum: ["products", "customers", "orders", "employees"], required: true },
    status: { type: String, enum: ["queued", "processing", "done", "failed"], default: "queued" },
    fileUrl: { type: String, default: null },
    fileContent: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

exportJobSchema.index({ companyId: 1, createdAt: -1 });

export const ExportJobModel: Model<ExportJobDoc> =
  (mongoose.models.ExportJob as Model<ExportJobDoc>) || mongoose.model<ExportJobDoc>("ExportJob", exportJobSchema);