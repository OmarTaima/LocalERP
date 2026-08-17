import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { ApprovalRequest } from "@erp/shared";

type DecisionDoc = { approverId: Types.ObjectId; approved: boolean; note: string; at: Date };

export type ApprovalRequestDoc = Omit<ApprovalRequest, "id" | "tenantId" | "entityId" | "requestedBy" | "chain" | "decisions"> & {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  chain: Types.ObjectId[];
  decisions: DecisionDoc[];
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const approvalRequestSchema = new Schema<ApprovalRequestDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    entityType: { type: String, enum: ["purchase-order", "expense-claim", "leave"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true, min: 0 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    chain: { type: [Schema.Types.ObjectId], default: [] },
    currentStep: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decisions: {
      type: [
        {
          approverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          approved: { type: Boolean, required: true },
          note: { type: String, default: "" },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

approvalRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
approvalRequestSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });

export const ApprovalRequestModel: Model<ApprovalRequestDoc> =
  (mongoose.models.ApprovalRequest as Model<ApprovalRequestDoc>) ||
  mongoose.model<ApprovalRequestDoc>("ApprovalRequest", approvalRequestSchema);