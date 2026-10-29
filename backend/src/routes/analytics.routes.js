const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireLevel } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/analytics.controller');

router.get('/benford', authenticateToken, ctrl.getBenford);
router.get('/duplicates', authenticateToken, ctrl.getDuplicates);
router.get('/thresholds', authenticateToken, ctrl.getThresholds);
router.get('/risk-scores', authenticateToken, ctrl.getRiskScores);
router.post('/save', authenticateToken, requireLevel('reviewer'), ctrl.saveRun);
router.get('/runs', authenticateToken, ctrl.listRuns);

// Tier 3
router.get('/msme-delays', authenticateToken, ctrl.getMsmeDelays);
router.get('/drift', authenticateToken, ctrl.getDrift);
router.get('/forecast', authenticateToken, ctrl.getForecast);
router.get('/peer-benchmark', authenticateToken, ctrl.getPeerBenchmark);
router.get('/shadow-procurement', authenticateToken, ctrl.getShadowProcurement);

module.exports = router;
