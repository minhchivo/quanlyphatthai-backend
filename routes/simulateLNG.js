const express = require('express');
const router = express.Router();
const { viewLNGData } = require('../controllers/simulateLNGController');

// POST /api/simulate-lng
router.post('/simulate-lng', viewLNGData);

module.exports = router;
