// routes/inputDataManagerRoutes.js

const express = require('express');
const router = express.Router();
const inputDataManagerController = require('../controllers/inputDataManagerController');

// API lấy toàn bộ dữ liệu input_data
router.get('/input-data', inputDataManagerController.getAllInputData);

// API xóa 1 dòng dữ liệu input_data
router.delete('/input-data/:id', inputDataManagerController.deleteInputData);

// API cập nhật 1 dòng dữ liệu input_data
router.put('/input-data/:id', inputDataManagerController.updateInputData);

module.exports = router;
