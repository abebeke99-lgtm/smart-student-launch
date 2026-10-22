const express = require('express');
const { query } = require('express-validator');
const {
  dashboard,
  ordersReport,
  salesReport,
  popularFoods,
  paymentsReport,
} = require('../controllers/reportController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
router.use(protect, authorize('admin'));
router.get('/dashboard', dashboard);
const reportFilters = [
  query('startDate').optional().isISO8601().withMessage('startDate must be an ISO date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be an ISO date'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
router.get(
  '/orders',
  ...reportFilters,
  query('status').optional().isIn(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']),
  query('customerSearch').optional().isString().trim().isLength({ max: 100 }),
  validateRequest,
  ordersReport,
);
router.get('/sales', ...reportFilters, validateRequest, salesReport);
router.get('/popular-foods', ...reportFilters, validateRequest, popularFoods);
router.get(
  '/payments',
  ...reportFilters,
  query('status').optional().isIn(['pending', 'successful', 'failed']),
  query('method').optional().isIn(['telebirr', 'cbe-birr', 'mobile-banking']),
  query('search').optional().isString().trim().isLength({ max: 200 }),
  validateRequest,
  paymentsReport,
);

module.exports = router;
