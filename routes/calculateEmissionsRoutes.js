const express = require('express');
const router = express.Router();
const calculateEmissionsController = require('../controllers/calculateEmissionsController');

// Đường dẫn: POST /api/calculate-emissions
router.post('/calculate-emissions', calculateEmissionsController.calculateEmissions);

module.exports = router;
