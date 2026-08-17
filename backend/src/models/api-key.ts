import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ApiKey } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type ApiKeyDoc = Omit<ApiKey, "id" | "companyId" | "lastUsedAt" | "revokedAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const apiKeySchema = new Schema<ApiKeyDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    permissions: { type: [String], required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const ApiKeyModel: Model<ApiKeyDoc> =
  (models.ApiKey as Model<ApiKeyDoc>) || model<ApiKeyDoc>("ApiKey", apiKeySchema);