const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  scanCases, getCases, getCaseById, getCaseTimeline, generateVerdict, getVerdict, submitFeedback, getAccuracy, getCaseHistory, updateCase, deleteCase, uploadEvidence, listEvidence, generatePlaybook, draftNegotiationEmail
} = require('../controllers/case.controller');
const { updateCaseValidation } = require('../middleware/validation.middleware');
const { requireLevel, requireRole } = require('../middleware/rbac.middleware');

router.post('/scan', authenticateToken, requireLevel('reviewer'), scanCases);
router.get('/accuracy', authenticateToken, getAccuracy);
router.get('/', authenticateToken, getCases);
router.get('/:id', authenticateToken, getCaseById);
router.get('/:id/history', authenticateToken, getCaseHistory);
router.get('/:id/timeline', authenticateToken, getCaseTimeline);
router.put('/:id', authenticateToken, requireLevel('reviewer'), updateCaseValidation, updateCase);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteCase);
router.post('/:id/verdict', authenticateToken, requireLevel('reviewer'), generateVerdict);
router.get('/:id/verdict', authenticateToken, getVerdict);
router.post('/:id/feedback', authenticateToken, requireLevel('reviewer'), submitFeedback);
router.post('/:id/playbook', authenticateToken, requireLevel('reviewer'), generatePlaybook);
router.post('/:id/evidence', authenticateToken, requireLevel('reviewer'), uploadEvidence);
router.get('/:id/evidence', authenticateToken, listEvidence);
router.post('/:id/negotiate', authenticateToken, requireLevel('reviewer'), draftNegotiationEmail);

module.exports = router;
