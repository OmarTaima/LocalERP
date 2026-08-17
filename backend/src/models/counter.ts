import mongoose from "mongoose";
import type { Model, Types } from "mongoose";

export type CounterDoc = {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  key: string;
  value: number;
};

const { Schema } = mongoose;

const counterSchema = new Schema<CounterDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true },
);

counterSchema.index({ companyId: 1, key: 1 }, { unique: true });

export const CounterModel: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) || mongoose.model<CounterDoc>("Counter", counterSchema);

export async function nextNumber(companyId: string, key: string, prefix: string, pad = 5): Promise<string> {
  const doc = await CounterModel.findOneAndUpdate(
    { companyId: new mongoose.Types.ObjectId(companyId), key },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}-${String(doc.value).padStart(pad, "0")}`;
}