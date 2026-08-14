const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const {
  scanCases, getCases, getCaseById, generateVerdict, getVerdict, submitFeedback, updateCase, deleteCase
} = require('../controllers/case.controller');
const { updateCaseValidation } = require('../middleware/validation.middleware');

router.post('/scan', authenticateToken, scanCases);
router.get('/', authenticateToken, getCases);
router.get('/:id', authenticateToken, getCaseById);
router.put('/:id', authenticateToken, updateCaseValidation, updateCase);
router.delete('/:id', authenticateToken, deleteCase);
router.post('/:id/verdict', authenticateToken, generateVerdict);
router.get('/:id/verdict', authenticateToken, getVerdict);
router.post('/:id/feedback', authenticateToken, submitFeedback);

module.exports = router;
