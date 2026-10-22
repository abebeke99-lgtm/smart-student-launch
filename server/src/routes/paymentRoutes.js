const express = require('express');
const { body, query } = require('express-validator');
const { simulatePayment, listMyPayments, getMyPayment, listPayments } = require('../controllers/paymentController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/simulate',
  protect,
  authorize('student'),
  body('orderId').isMongoId().withMessage('A valid order ID is required'),
  body('method').isIn(['telebirr', 'cbe-birr', 'mobile-banking']).withMessage('Unsupported payment method'),
  body('simulatedResponse').optional().isIn(['success', 'failure']),
  validateRequest,
  simulatePayment,
);
router.get('/my', protect, authorize('student'), listMyPayments);
router.get('/:id', protect, authorize('student'), getMyPayment);
router.get(
  '/',
  protect,
  authorize('admin'),
  query('status').optional().isIn(['pending', 'successful', 'failed']),
  query('method').optional().isIn(['telebirr', 'cbe-birr', 'mobile-banking']),
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
  listPayments,
);

module.exports = router;
