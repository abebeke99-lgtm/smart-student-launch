const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Smart Cafeteria Ordering System API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
