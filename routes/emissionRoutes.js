const express = require('express');
const router = express.Router();
const emissionController = require('../controllers/emissionController');

// Tổng phát thải
router.get('/', emissionController.getTotalEmissionsByShip);
router.get('/summary', emissionController.getSummaryData);
router.get('/combined-summary', emissionController.getCombinedSummary);

// Các API mới
router.get('/main-engine-cruising', emissionController.getMainEngineCruising);
router.get('/main-engine-maneuvering', emissionController.getMainEngineManeuvering);
router.get('/aux-engine-cruising', emissionController.getAuxEngineCruising);
router.get('/aux-engine-maneuvering', emissionController.getAuxEngineManeuvering);
router.get('/aux-engine-anchorage', emissionController.getAuxEngineAnchorage);

module.exports = router;
