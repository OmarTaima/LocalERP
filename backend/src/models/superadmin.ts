import mongoose from "mongoose";
import type { Model, Types } from "mongoose";

const { model, models, Schema } = mongoose;

export type SuperAdminDoc = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

const superAdminSchema = new Schema<SuperAdminDoc>(
  {
    email: { type: String, required: true, lowercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const SuperAdminModel: Model<SuperAdminDoc> =
  (models.SuperAdmin as Model<SuperAdminDoc>) || model<SuperAdminDoc>("SuperAdmin", superAdminSchema);