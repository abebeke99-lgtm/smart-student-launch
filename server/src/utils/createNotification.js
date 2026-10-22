const Notification = require('../models/Notification');

function createNotification(user, order, title, message, type = 'order') {
  return Notification.create({ user, order, title, message, type });
}

module.exports = createNotification;
