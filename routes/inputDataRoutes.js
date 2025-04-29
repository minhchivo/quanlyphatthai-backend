const express = require('express');
const router = express.Router();
const inputDataController = require('../controllers/inputDataController');

// Đường dẫn: POST /api/input-data
router.post('/input-data', inputDataController.inputData);

module.exports = router;
