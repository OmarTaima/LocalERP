import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { AuditLog } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type AuditLogDoc = Omit<AuditLog, "id" | "companyId" | "userId" | "entityId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  entityId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: ["create", "update", "delete", "approve", "reject", "login", "export", "terminate", "pay"],
      required: true,
    },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    changes: {
      before: { type: Schema.Types.Mixed, default: null },
      after: { type: Schema.Types.Mixed, default: null },
    },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, entity: 1, entityId: 1 });
auditLogSchema.index({ companyId: 1, userId: 1, createdAt: -1 });

export const AuditLogModel: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) || model<AuditLogDoc>("AuditLog", auditLogSchema);