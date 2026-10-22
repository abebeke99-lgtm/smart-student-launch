const express = require('express');
const { body, param } = require('express-validator');
const {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require('../controllers/cartController');
const { authorize, protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const studentOnly = [protect, authorize('student')];
const menuItemIdValidation = param('menuItemId')
  .isMongoId()
  .withMessage('Menu item ID is invalid');
const quantityValidation = body('quantity')
  .isInt({ min: 1, max: 20 })
  .withMessage('Quantity must be a whole number between 1 and 20')
  .bail()
  .toInt();

router.get('/', ...studentOnly, getCart);
router.post(
  '/items',
  ...studentOnly,
  body('menuItemId').isMongoId().withMessage('A valid menu item ID is required'),
  quantityValidation,
  validateRequest,
  addCartItem,
);
router.put(
  '/items/:menuItemId',
  ...studentOnly,
  menuItemIdValidation,
  quantityValidation,
  validateRequest,
  updateCartItem,
);
router.patch(
  '/items/:menuItemId',
  ...studentOnly,
  menuItemIdValidation,
  quantityValidation,
  validateRequest,
  updateCartItem,
);
router.delete(
  '/items/:menuItemId',
  ...studentOnly,
  menuItemIdValidation,
  validateRequest,
  removeCartItem,
);
router.delete('/', ...studentOnly, clearCart);

module.exports = router;
