const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createOrder,
  listMyOrders,
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/orderController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);
router.post(
  '/',
  authorize('student'),
  body('pickupType').isIn(['self-pickup', 'campus-delivery']).withMessage('Invalid pickup type'),
  body('deliveryLocation').optional().isString().trim().isLength({ max: 300 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
  createOrder,
);
router.get('/my', authorize('student'), listMyOrders);
router.get(
  '/',
  authorize('admin', 'foodmaker'),
  query('status').optional().isIn(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'failed']),
  query('search').optional().isString().trim().isLength({ max: 80 }),
  query('customer').optional().isMongoId(),
  query('customerSearch').optional().isString().trim().isLength({ max: 100 }),
  query('startDate').optional().isISO8601().withMessage('Start date must be an ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be an ISO date'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  validateRequest,
  listOrders,
);
router.get('/:id', param('id').isMongoId(), validateRequest, getOrder);
router.patch(
  '/:id/status',
  authorize('admin', 'foodmaker'),
  param('id').isMongoId(),
  body('status').isIn(['confirmed', 'preparing', 'ready', 'served', 'cancelled']),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
  updateOrderStatus,
);
router.patch(
  '/:id/cancel',
  authorize('student', 'admin'),
  param('id').isMongoId(),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
  cancelOrder,
);

module.exports = router;
