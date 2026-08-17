import type { NotificationType } from "@erp/shared";
import { NotificationModel } from "../models";
import { publish } from "../events/bus";

type CreateNotificationOptions = {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

export async function createNotification(options: CreateNotificationOptions): Promise<void> {
  await NotificationModel.create({
    companyId: options.companyId,
    userId: options.userId,
    type: options.type,
    title: options.title,
    body: options.body ?? "",
    link: options.link ?? "",
    isRead: false,
  });
  publish({
    type: "notification.created",
    payload: { companyId: options.companyId, userId: options.userId, type: options.type },
  });
}