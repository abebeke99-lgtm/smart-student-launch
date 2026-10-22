const express = require('express');
const { login, logout, forgotPassword, verifyOtp, resetPasswordOtp, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password-otp', resetPasswordOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
