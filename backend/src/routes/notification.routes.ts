import { Router } from "express";
import { auth } from "../middleware/auth";
import { rbac } from "../middleware/rbac";
import { tenant } from "../middleware/tenant";
import { asyncHandler } from "../utils/async-handler";
import { NotificationModel } from "../models";

export const notificationRouter = Router();

notificationRouter.use(auth, tenant, rbac("notifications:read"));

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const items = await NotificationModel.find({ tenantId: req.tenantId, userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unread = await NotificationModel.countDocuments({
      tenantId: req.tenantId,
      userId: req.userId,
      isRead: false,
    });
    res.json({
      items: items.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unread,
    });
  }),
);

notificationRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await NotificationModel.updateOne(
      { _id: req.params.id, tenantId: req.tenantId, userId: req.userId },
      { isRead: true },
    );
    res.json({ ok: true });
  }),
);

notificationRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await NotificationModel.updateMany(
      { tenantId: req.tenantId, userId: req.userId, isRead: false },
      { isRead: true },
    );
    res.json({ ok: true });
  }),
);