const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { createContactMessage } = require('../controllers/contactController');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many contact requests. Please try again later.' },
    });
  },
});

router.post(
  '/',
  contactLimiter,
  body('fullName')
    .isString().withMessage('Full name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
  body('email')
    .isString().withMessage('A valid email address is required')
    .bail()
    .trim()
    .isEmail().withMessage('A valid email address is required')
    .bail()
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email address cannot exceed 254 characters'),
  body('subject')
    .isString().withMessage('Subject is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage('Subject must be between 2 and 150 characters'),
  body('message')
    .isString().withMessage('Message is required')
    .bail()
    .trim()
    .isLength({ min: 10, max: 3000 }).withMessage('Message must be between 10 and 3000 characters'),
  validateRequest,
  createContactMessage,
);

module.exports = router;
