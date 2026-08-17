import mongoose from "mongoose";
import type { Model, Types } from "mongoose";

export type CounterDoc = {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  key: string;
  value: number;
};

const { Schema } = mongoose;

const counterSchema = new Schema<CounterDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true },
);

counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const CounterModel: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) || mongoose.model<CounterDoc>("Counter", counterSchema);

export async function nextNumber(tenantId: string, key: string, prefix: string, pad = 5): Promise<string> {
  const doc = await CounterModel.findOneAndUpdate(
    { tenantId: new mongoose.Types.ObjectId(tenantId), key },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}-${String(doc.value).padStart(pad, "0")}`;
}