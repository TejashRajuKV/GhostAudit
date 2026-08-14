const express = require('express');
const { getTransactions, createTransaction, bulkCreateTransactions } = require('../controllers/transaction.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { transactionQueryValidation } = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/', authenticateToken, transactionQueryValidation, getTransactions);
router.post('/', authenticateToken, createTransaction);
router.post('/bulk', authenticateToken, bulkCreateTransactions);

module.exports = router;
