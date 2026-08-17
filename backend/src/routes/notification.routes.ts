import { Router } from "express";
import { auth } from "../middleware/auth";
import { company } from "../middleware/company";
import { asyncHandler } from "../utils/async-handler";
import { NotificationModel } from "../models";

export const notificationRouter = Router();

notificationRouter.use(auth, company);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const items = await NotificationModel.find({ companyId: req.companyId, userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unread = await NotificationModel.countDocuments({
      companyId: req.companyId,
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
      { _id: req.params.id, companyId: req.companyId, userId: req.userId },
      { isRead: true },
    );
    res.json({ ok: true });
  }),
);

notificationRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await NotificationModel.updateMany(
      { companyId: req.companyId, userId: req.userId, isRead: false },
      { isRead: true },
    );
    res.json({ ok: true });
  }),
);