const { getDb } = require('../db');

function getTransactions(req, res) {
  try {
    const db = getDb();
    const transactions = db.prepare(`
      SELECT t.*, v.name as vendor_name, v.is_ghost 
      FROM transactions t
      LEFT JOIN vendors v ON t.vendor_id = v.id
      ORDER BY t.invoice_date DESC
    `).all();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
}

function createTransaction(req, res) {
  try {
    const db = getDb();
    const { vendor_id, amount, invoice_number, invoice_date, payment_date, description } = req.body;
    
    if (!vendor_id || !amount || !invoice_number || !invoice_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (payment_date && new Date(payment_date) < new Date(invoice_date)) {
      return res.status(400).json({ error: 'Payment date cannot be earlier than invoice date.' });
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, description, approval_threshold, is_flagged) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    const info = stmt.run(vendor_id, amount, invoice_number, invoice_date, payment_date || null, description || '', 100000);
    
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transaction', details: err.message });
  }
}

function bulkCreateTransactions(req, res) {
  try {
    const db = getDb();
    const { transactions } = req.body;
    
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Expected an array of transactions' });
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, description, approval_threshold, is_flagged) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertMany = db.transaction((txs) => {
      let count = 0;
      for (const tx of txs) {
        if (tx.vendor_id && tx.amount && tx.invoice_number && tx.invoice_date) {
          if (tx.payment_date && new Date(tx.payment_date) < new Date(tx.invoice_date)) {
            continue; // Skip invalid records
          }
          stmt.run(tx.vendor_id, tx.amount, tx.invoice_number, tx.invoice_date, tx.payment_date || null, tx.description || '', 100000);
          count++;
        }
      }
      return count;
    });

    const count = insertMany(transactions);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk create transactions', details: err.message });
  }
}

module.exports = { getTransactions, createTransaction, bulkCreateTransactions };
