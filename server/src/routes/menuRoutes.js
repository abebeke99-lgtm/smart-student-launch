const express = require('express');
const { body, param, query } = require('express-validator');
const {
  listMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} = require('../controllers/menuController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { uploadImage } = require('../middleware/uploadImage');
const { removeUploadedFile } = require('../utils/imageFiles');
const AppError = require('../utils/AppError');

const router = express.Router();
const adminOnly = [protect, authorize('admin')];
const idValidation = [param('id').isMongoId().withMessage('Menu item ID is invalid')];

const createFields = [
  body('name')
    .isString().withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .bail()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('price')
    .isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
    .bail()
    .toFloat(),
  body('category').isMongoId().withMessage('A valid category is required'),
  body('preparationTime')
    .isInt({ min: 0 }).withMessage('Preparation time must be a non-negative whole number')
    .bail()
    .toInt(),
];

const updateFields = [
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .bail()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
    .bail()
    .toFloat(),
  body('category').optional().isMongoId().withMessage('Category must be a valid ID'),
  body('preparationTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Preparation time must be a non-negative whole number')
    .bail()
    .toInt(),
];

const imageUrlValidation = body('imageUrl')
  .optional({ values: 'falsy' })
  .custom((value) => {
    if (/^\/uploads\/[a-f0-9-]+\.(jpg|png|gif|webp)$/i.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  })
  .withMessage('Image URL must be HTTP(S) or a local uploaded image path');
const availabilityValidation = body('isAvailable')
  .optional()
  .customSanitizer((value) => (value === 'true' ? true : value === 'false' ? false : value))
  .isBoolean().withMessage('isAvailable must be a boolean');
const publishedValidation = body('isPublished')
  .optional()
  .customSanitizer((value) => (value === 'true' ? true : value === 'false' ? false : value))
  .isBoolean().withMessage('isPublished must be a boolean');

async function rejectImageUrlWithUpload(req, res, next) {
  if (req.file && req.body.imageUrl) {
    try {
      await removeUploadedFile(req.file);
    } catch (error) {
      return next(error);
    }
    return next(new AppError('Provide either an uploaded image or imageUrl, not both', 400));
  }
  return next();
}

router.get(
  '/',
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isMongoId().withMessage('Category must be a valid ID'),
  query('categoryId').optional().isMongoId().withMessage('Category must be a valid ID'),
  query('availability').optional().isIn(['true', 'false']).withMessage('Availability must be true or false'),
  query('isAvailable').optional().isIn(['true', 'false']).withMessage('isAvailable must be true or false'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  validateRequest,
  listMenu,
);
router.get(
  '/admin',
  ...adminOnly,
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('category').optional().isMongoId(),
  query('isAvailable').optional().isIn(['true', 'false']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
  listMenu,
);
router.get('/:id', idValidation, validateRequest, getMenuItem);
router.post(
  '/',
  ...adminOnly,
  uploadImage,
  rejectImageUrlWithUpload,
  createFields,
  imageUrlValidation,
  availabilityValidation,
  publishedValidation,
  validateRequest,
  createMenuItem,
);
router.put(
  '/:id',
  ...adminOnly,
  idValidation,
  uploadImage,
  rejectImageUrlWithUpload,
  updateFields,
  imageUrlValidation,
  availabilityValidation,
  publishedValidation,
  validateRequest,
  updateMenuItem,
);
router.patch(
  '/:id',
  ...adminOnly,
  idValidation,
  uploadImage,
  rejectImageUrlWithUpload,
  updateFields,
  imageUrlValidation,
  availabilityValidation,
  publishedValidation,
  validateRequest,
  updateMenuItem,
);
router.patch(
  '/:id/availability',
  ...adminOnly,
  idValidation,
  body('isAvailable')
    .customSanitizer((value) => (value === 'true' ? true : value === 'false' ? false : value))
    .isBoolean().withMessage('isAvailable must be a boolean'),
  validateRequest,
  toggleAvailability,
);
router.delete('/:id', ...adminOnly, idValidation, validateRequest, deleteMenuItem);

module.exports = router;
