// Immutable, hash-chained audit log service.
// Each entry's hash covers its content AND the previous entry's hash,
// so any tampering (edit/delete of a past row) breaks the chain.
const crypto = require('crypto');
const { getDb } = require('../db');

function sha256(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function appendAudit(action, entity_type, entity_id, user_email, details) {
  const db = getDb();
  const last = db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
  const prev_hash = last ? last.hash : 'GENESIS';
  const created_at = new Date().toISOString();

  const record = { action, entity_type, entity_id, user_email, details, prev_hash, created_at };
  const hash = sha256(record);

  db.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, user_email, details, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(action, entity_type, entity_id, user_email || 'system', JSON.stringify(details ?? null), prev_hash, hash, created_at);

  return hash;
}

// Verify the entire chain. Returns { valid, checked, brokenAt }
function verifyChain() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id ASC').all();
  let prev = 'GENESIS';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.prev_hash !== prev) return { valid: false, checked: i + 1, brokenAt: r.id, reason: 'prev_hash mismatch' };
    const recomputed = sha256({
      action: r.action, entity_type: r.entity_type, entity_id: r.entity_id,
      user_email: r.user_email, details: r.details, prev_hash: r.prev_hash, created_at: r.created_at
    });
    if (recomputed !== r.hash) return { valid: false, checked: i + 1, brokenAt: r.id, reason: 'content hash mismatch' };
    prev = r.hash;
  }
  return { valid: true, checked: rows.length, brokenAt: null };
}

module.exports = { appendAudit, verifyChain };
