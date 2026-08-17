import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { User } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type UserDoc = Omit<User, "id" | "tenantId" | "roleId" | "lastLoginAt"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  roleId: Types.ObjectId;
  lastLoginAt: Date | null;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    avatarUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, roleId: 1 });

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);