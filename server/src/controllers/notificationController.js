const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

async function listNotifications(req, res) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  return res.status(200).json({
    success: true,
    data: { notifications, unreadCount },
  });
}

async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { isRead: true } },
    { new: true, runValidators: true },
  );
  if (!notification) throw new AppError('Notification not found', 404);
  return res.status(200).json({ success: true, data: { notification } });
}

async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
  return res.status(200).json({ success: true, message: 'Notifications marked as read' });
}

module.exports = { listNotifications, markNotificationRead, markAllRead };
