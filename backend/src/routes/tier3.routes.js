const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/tier3.controller');

// Read-only intelligence
router.get('/dna/:vendorId', authenticateToken, ctrl.getComplianceDna);          // #18
router.get('/behavioral', authenticateToken, ctrl.getBehavioral);                // #23
router.get('/invisible-employee', authenticateToken, ctrl.getInvisibleEmployee); // #22
router.get('/digital-twin', authenticateToken, ctrl.getDigitalTwin);             // #24
router.get('/multi-regulator', authenticateToken, ctrl.getMultiRegulator);       // #26
router.get('/dossier/:vendorId', authenticateToken, ctrl.getDossier);            // #27
router.get('/msme-coach', authenticateToken, ctrl.getCoach);                     // #33
router.get('/reverse-audit', authenticateToken, ctrl.getReverseAudit);           // #15
router.get('/clone-queue', authenticateToken, ctrl.getCloneQueue);               // #17

// Analyzers (POST payloads)
router.post('/shock-simulator', authenticateToken, ctrl.runShock);               // #34
router.post('/ad-shield', authenticateToken, ctrl.runAdShield);                  // #35
router.post('/dark-patterns', authenticateToken, ctrl.runDarkPattern);           // #36
router.post('/collateral-audit', authenticateToken, ctrl.runCollateral);         // #37
router.post('/hsn-compliance', authenticateToken, ctrl.runHsn);                  // #38
router.post('/chat-compliance', authenticateToken, ctrl.runChatScan);            // #39
router.post('/contract-vs-verbal', authenticateToken, ctrl.runContractDiff);     // #40

// Compliance Memory (#14)
router.post('/memory', authenticateToken, ctrl.saveMemory);
router.get('/memory/recall', authenticateToken, ctrl.recall);
router.post('/memory/recall', authenticateToken, ctrl.recall);

module.exports = router;
