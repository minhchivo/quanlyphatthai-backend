const express = require('express');
const router = express.Router();
const shipController = require('../controllers/shipController');

// 🚨 Phải đặt cố định trước động
router.get('/summary', shipController.getSummaryData); // trước
router.get('/:id', shipController.getShipById);         // sau
router.get('/', shipController.getShips);

module.exports = router;
