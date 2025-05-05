const express = require('express');
const router = express.Router();
const { simulateLNG } = require('../controllers/simulateLNGController');

// POST /api/simulate-lng
router.post('/simulate-lng', simulateLNG);

module.exports = router;
