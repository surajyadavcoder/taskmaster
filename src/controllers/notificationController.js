const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getNotifications = catchAsync(async (req, res) => {
  const { unreadOnly } = req.query;
  const filter = { recipient: req.user._id };
  if (unreadOnly === 'true') filter.read = false;

  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);

  res.status(200).json({ success: true, count: notifications.length, notifications });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    recipient: req.user._id,
  });

  if (!notification) return next(new AppError('Notification not found.', 404));

  notification.read = true;
  await notification.save();

  res.status(200).json({ success: true, notification });
});

exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });

  res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});
