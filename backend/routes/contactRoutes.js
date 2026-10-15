const express = require('express');
const {
  submitContactMessage,
  getContactMessages,
  updateMessageStatus,
  deleteMessage,
  getAdminContactInfo,
  updateAdminContactInfo,
} = require('../controllers/contactController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/', submitContactMessage);
router.post('/submit', submitContactMessage);
router.post('/message', submitContactMessage);
router.get('/admin-info', getAdminContactInfo);
router.put('/admin-info', authenticateToken, authorizeRoles('admin', 'systemadmin'), updateAdminContactInfo);

router.get('/messages', authenticateToken, authorizeRoles('admin', 'college_dean', 'academic_directorate'), getContactMessages);
router.put('/messages/:id/status', authenticateToken, authorizeRoles('admin', 'college_dean', 'academic_directorate'), updateMessageStatus);
router.delete('/messages/:id', authenticateToken, authorizeRoles('admin'), deleteMessage);

module.exports = router;
