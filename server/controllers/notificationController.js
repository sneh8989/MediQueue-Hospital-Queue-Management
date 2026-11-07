import * as notificationModel from '../models/notificationModel.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

export const listMyNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  const notifications = await notificationModel.findAllForUser(req.user.sub, { unreadOnly });
  res.json({ success: true, count: notifications.length, notifications });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationModel.countUnread(req.user.sub);
  res.json({ success: true, count });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationModel.findById(req.params.id);
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== req.user.sub) {
    throw new AppError('You can only mark your own notifications as read', 403);
  }
  const updated = await notificationModel.markRead(req.params.id);
  res.json({ success: true, notification: updated });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const count = await notificationModel.markAllRead(req.user.sub);
  res.json({ success: true, markedCount: count });
});
