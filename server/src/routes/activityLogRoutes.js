const express = require('express');
const { query } = require('express-validator');
const { listActivityLogs } = require('../controllers/activityLogController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
router.get(
  '/',
  protect,
  authorize('admin'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('entity').optional().isString().trim().isLength({ max: 100 }),
  query('action').optional().isString().trim().isLength({ max: 200 }),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  listActivityLogs,
);

module.exports = router;
