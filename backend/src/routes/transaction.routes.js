const express = require('express');
const { getTransactions, createTransaction, bulkCreateTransactions } = require('../controllers/transaction.controller');

const router = express.Router();

router.get('/', getTransactions);
router.post('/', createTransaction);
router.post('/bulk', bulkCreateTransactions);

module.exports = router;
