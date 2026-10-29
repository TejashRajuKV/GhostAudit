// CSV/XLSX bulk import for transactions.
// POST /api/v1/transactions/import  (multipart form-data, field name "file")
// Expected columns (case-insensitive): vendor (name or id), amount, invoice_number,
// invoice_date, payment_date (optional), description (optional), threshold (optional)
const { getDb } = require('../db');
const { appendAudit } = require('../services/audit.service');

function parseCsv(text) {
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function normDate(s) {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function importTransactions(req, res) {
  try {
    const db = getDb();

    // Accept JSON array (pre-parsed by frontend) OR raw CSV text
    let rows;
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows; // array of objects with expected keys
      return finish(rows);
    }
    const csvText = req.body?.csv;
    if (!csvText) return res.status(400).json({ error: 'Provide "csv" text or "rows" array' });

    const grid = parseCsv(String(csvText));
    if (grid.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
    const headers = grid[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const idx = (names) => headers.findIndex(h => names.includes(h));
    const colVendor = idx(['vendor', 'vendorname', 'supplier', 'party']);
    const colAmount = idx(['amount', 'value', 'total']);
    const colInvNo = idx(['invoicenumber', 'invoiceno', 'invno', 'documentno', 'invoice']);
    const colInvDate = idx(['invoicedate', 'date', 'documentdate']);
    const colPayDate = idx(['paymentdate', 'paiddate']);
    const colDesc = idx(['description', 'narration', 'details']);
    const colThresh = idx(['threshold', 'approvalthreshold', 'limit']);

    if (colVendor < 0 || colAmount < 0 || colInvNo < 0 || colInvDate < 0) {
      return res.status(400).json({ error: 'Missing required columns: vendor, amount, invoice_number, invoice_date' });
    }

    rows = grid.slice(1).map(r => ({
      vendor: r[colVendor],
      amount: r[colAmount],
      invoice_number: r[colInvNo],
      invoice_date: r[colInvDate],
      payment_date: colPayDate >= 0 ? r[colPayDate] : '',
      description: colDesc >= 0 ? r[colDesc] : '',
      approval_threshold: colThresh >= 0 ? r[colThresh] : '',
    }));
    finish(rows);

    function finish(records) {
      const vendors = db.prepare('SELECT id, name FROM vendors').all();
      const byNameLower = Object.fromEntries(vendors.map(v => [v.name.toLowerCase(), v.id]));
      const ensureVendor = db.prepare('INSERT INTO vendors (name, ghost_score) VALUES (?, 0)');

      const insert = db.prepare(`
        INSERT INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, description, approval_threshold, is_flagged)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const errors = [];
      let count = 0;
      const tx = db.transaction(() => {
        records.forEach((rec, i) => {
          const line = i + 1;
          const amount = parseFloat(String(rec.amount ?? '').replace(/[₹,\s]/g, ''));
          const invDate = normDate(rec.invoice_date);
          const payDate = rec.payment_date ? normDate(rec.payment_date) : null;
          const invNo = String(rec.invoice_number ?? '').trim();
          const vendorKey = String(rec.vendor ?? '').trim();
          if (!vendorKey || !isFinite(amount) || amount <= 0 || !invNo || !invDate) {
            errors.push({ line, reason: 'missing/invalid vendor, amount, invoice_number or invoice_date' });
            return;
          }
          if (payDate && new Date(payDate) < new Date(invDate)) {
            errors.push({ line, reason: 'payment date earlier than invoice date' });
            return;
          }
          let vendorId = parseInt(vendorKey);
          if (!vendors.find(v => v.id === vendorId)) {
            vendorId = byNameLower[vendorKey.toLowerCase()];
            if (!vendorId) {
              const info = ensureVendor.run(vendorKey);
              vendorId = Number(info.lastInsertRowid);
              byNameLower[vendorKey.toLowerCase()] = vendorId;
            }
          }
          const th = parseFloat(rec.approval_threshold) || 100000;
          insert.run(vendorId, amount, invNo, invDate, payDate, String(rec.description ?? ''), th);
          count++;
        });
      });
      tx();

      appendAudit('TX_IMPORT', 'transaction', null, req.user?.email, { imported: count, failed: errors.length });
      res.json({ success: true, imported: count, failed: errors.length, errors: errors.slice(0, 20) });
    }
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
}

module.exports = { importTransactions };
