const express = require('express');
const { body, param, query } = require('express-validator');
const {
  listUsers,
  getUser,
  updateProfile,
  updateUserStatus,
  updateUserRole,
  deleteUser,
} = require('../controllers/userController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
router.use(protect);
router.patch(
  '/me',
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  validateRequest,
  updateProfile,
);
router.get(
  '/',
  authorize('admin'),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('role').optional().isIn(['student', 'foodmaker', 'admin']),
  query('isActive').optional().isIn(['true', 'false']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
  listUsers,
);
router.get('/:id', authorize('admin'), param('id').isMongoId(), validateRequest, getUser);
router.patch(
  '/:id/status',
  authorize('admin'),
  param('id').isMongoId(),
  body('isActive').isBoolean().withMessage('isActive must be a boolean').bail().toBoolean(),
  validateRequest,
  updateUserStatus,
);
router.patch(
  '/:id/role',
  authorize('admin'),
  param('id').isMongoId(),
  body('role').isIn(['student', 'foodmaker', 'admin']),
  validateRequest,
  updateUserRole,
);
router.delete('/:id', authorize('admin'), param('id').isMongoId(), validateRequest, deleteUser);

module.exports = router;
