const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const {
  register,
  login,
  getCurrentUser,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

function createAuthLimiter(message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { message },
    },
  });
}

const registerLimiter = createAuthLimiter('Too many registration attempts. Try again later.');
const loginLimiter = createAuthLimiter('Too many login attempts. Try again later.');

const registrationValidation = [
  body('name')
    .isString().withMessage('Name must be a string')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isString().withMessage('Email must be a string')
    .bail()
    .trim()
    .isEmail().withMessage('Enter a valid email address')
    .bail()
    .customSanitizer((email) => email.toLowerCase()),
  body('password')
    .isString().withMessage('Password must be a string')
    .bail()
    .custom((password) => Buffer.byteLength(password, 'utf8') >= 8)
    .withMessage('Password must be at least 8 bytes')
    .bail()
    .custom((password) => Buffer.byteLength(password, 'utf8') <= 72)
    .withMessage('Password cannot exceed 72 bytes'),
];

const loginValidation = [
  body('email')
    .isString().withMessage('Email must be a string')
    .bail()
    .trim()
    .isEmail().withMessage('Enter a valid email address')
    .bail()
    .customSanitizer((email) => email.toLowerCase()),
  body('password')
    .isString().withMessage('Password must be a string')
    .bail()
    .notEmpty().withMessage('Password is required')
    .bail()
    .custom((password) => Buffer.byteLength(password, 'utf8') <= 72)
    .withMessage('Password cannot exceed 72 bytes'),
];

router.post('/register', registerLimiter, registrationValidation, validateRequest, register);
router.post('/login', loginLimiter, loginValidation, validateRequest, login);
router.get('/me', protect, getCurrentUser);
router.post('/logout', protect, logout);

module.exports = router;
