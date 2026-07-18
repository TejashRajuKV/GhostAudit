const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { generateReport, getReports, getReportById } = require('../controllers/report.controller');

router.post('/generate', authenticateToken, generateReport);
router.get('/', authenticateToken, getReports);
router.get('/:id', authenticateToken, getReportById);

module.exports = router;
