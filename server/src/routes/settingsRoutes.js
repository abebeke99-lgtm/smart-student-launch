const express = require('express');
const { getSystemSettings } = require('../controllers/settingsController');
const { authorize, protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('admin'), getSystemSettings);

module.exports = router;
