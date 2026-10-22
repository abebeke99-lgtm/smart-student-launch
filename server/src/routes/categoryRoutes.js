const express = require('express');
const { body, param } = require('express-validator');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const adminOnly = [protect, authorize('admin')];
const categoryIdValidation = [param('id').isMongoId().withMessage('Category ID is invalid')];
const createNameValidation = body('name')
  .isString().withMessage('Name must be a string')
  .bail()
  .trim()
  .isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters');
const updateNameValidation = body('name')
  .optional()
  .isString().withMessage('Name must be a string')
  .bail()
  .trim()
  .isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters');
const descriptionValidation = body('description')
  .optional()
  .isString().withMessage('Description must be a string')
  .bail()
  .trim()
  .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters');

router.get('/', listCategories);
router.get('/admin', ...adminOnly, listCategories);
router.post(
  '/',
  ...adminOnly,
  createNameValidation,
  descriptionValidation,
  validateRequest,
  createCategory,
);
router.patch(
  '/:id',
  ...adminOnly,
  categoryIdValidation,
  updateNameValidation,
  descriptionValidation,
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean').bail().toBoolean(),
  validateRequest,
  updateCategory,
);
router.put(
  '/:id',
  ...adminOnly,
  categoryIdValidation,
  updateNameValidation,
  descriptionValidation,
  validateRequest,
  updateCategory,
);
router.delete('/:id', ...adminOnly, categoryIdValidation, validateRequest, deleteCategory);

module.exports = router;
