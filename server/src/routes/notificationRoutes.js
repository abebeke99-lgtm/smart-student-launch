const express = require('express');
const { param } = require('express-validator');
const {
  listNotifications,
  markNotificationRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
router.use(protect);
router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch(
  '/:id/read',
  param('id').isMongoId().withMessage('Notification ID is invalid'),
  validateRequest,
  markNotificationRead,
);

module.exports = router;
