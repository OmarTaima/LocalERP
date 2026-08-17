import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { TwoFactor } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type TwoFactorDoc = Omit<TwoFactor, "id" | "companyId" | "userId" | "verifiedAt"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const twoFactorSchema = new Schema<TwoFactorDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    secretEncrypted: { type: String, required: true },
    recoveryCodes: { type: [String], required: true },
    enabled: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

twoFactorSchema.index({ companyId: 1, userId: 1 }, { unique: true });

export const TwoFactorModel: Model<TwoFactorDoc> =
  (models.TwoFactor as Model<TwoFactorDoc>) || model<TwoFactorDoc>("TwoFactor", twoFactorSchema);