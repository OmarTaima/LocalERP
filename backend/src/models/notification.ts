import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { Notification } from "@erp/shared";

const { model, models, Schema } = mongoose;

export type NotificationDoc = Omit<Notification, "id" | "companyId" | "userId"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const notificationSchema = new Schema<NotificationDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["stock-alert", "order", "approval", "invoice", "leave", "system"],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ companyId: 1, userId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) || model<NotificationDoc>("Notification", notificationSchema);