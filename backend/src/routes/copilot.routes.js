const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireLevel } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/copilot.controller');

router.post('/ask', authenticateToken, ctrl.askLedger);
router.post('/policy', authenticateToken, requireLevel('reviewer'), ctrl.ingestPolicy);
router.get('/policy', authenticateToken, ctrl.listPolicies);

module.exports = router;
