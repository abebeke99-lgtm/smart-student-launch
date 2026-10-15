const express = require('express');
const { getSystemStats, getIEPSFocusAreas, getCollegesWithDepartments } = require('../controllers/publicController');

const router = express.Router();

router.get('/system-stats', getSystemStats);
router.get('/focus-areas', getIEPSFocusAreas);
router.get('/colleges-with-departments', getCollegesWithDepartments);

module.exports = router;