const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Các API cho trang chủ
router.get('/summary', dashboardController.getSummary);
router.get('/ships-by-day', dashboardController.getShipsByDay);
router.get('/emissions-by-day', dashboardController.getEmissionsByDay);
router.get('/latest-ships', dashboardController.getLatestShips);

// API thêm mới cho bộ lọc tháng/năm
router.get('/ships-by-month', dashboardController.getShipsByMonth);
router.get('/emissions-by-month', dashboardController.getEmissionsByMonth);
router.get('/compare-months', dashboardController.compareTwoMonths);

module.exports = router;
