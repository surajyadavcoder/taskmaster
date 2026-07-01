const Notification = require('../models/Notification');

let ioInstance = null;

function initNotificationService(io) {
  ioInstance = io;
}

// Creates a notification document and, if a socket connection exists
// for that user, pushes it to them immediately.
async function sendNotification({ recipient, type, message, task, team }) {
  const notification = await Notification.create({ recipient, type, message, task, team });

  if (ioInstance) {
    ioInstance.to(recipient.toString()).emit('notification', {
      id: notification._id,
      type: notification.type,
      message: notification.message,
      task: notification.task,
      team: notification.team,
      createdAt: notification.createdAt,
    });
  }

  return notification;
}

module.exports = { initNotificationService, sendNotification };
