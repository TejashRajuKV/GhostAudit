const { getDb } = require('../db');

// GET /api/notifications — current user's notifications
function listNotifications(req, res) {
  const db = getDb();
  const email = req.user?.email;
  const items = db.prepare(
    'SELECT * FROM notifications WHERE user_email = ? ORDER BY created_at DESC LIMIT 50'
  ).all(email);
  const unread = items.filter(n => !n.is_read).length;
  res.json({ items, unread });
}

// POST /api/notifications — create (admin/reviewer targeted alerts)
function createNotification(req, res) {
  const db = getDb();
  const { user_email, title, body, link } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const target = user_email || req.user?.email;
  const info = db.prepare(
    'INSERT INTO notifications (user_email, title, body, link) VALUES (?, ?, ?, ?)'
  ).run(target, title, body || '', link || null);
  res.json({ success: true, id: info.lastInsertRowid });
}

// POST /api/notifications/:id/read
function markRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_email = ?')
    .run(req.params.id, req.user?.email);
  res.json({ success: true });
}

// POST /api/notifications/read-all
function markAllRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_email = ?').run(req.user?.email);
  res.json({ success: true });
}

// Helper used by other controllers (scan results → notify all users)
function broadcast(title, body, link) {
  const db = getDb();
  const users = db.prepare('SELECT email FROM users').all();
  const stmt = db.prepare('INSERT INTO notifications (user_email, title, body, link) VALUES (?, ?, ?, ?)');
  for (const u of users) stmt.run(u.email, title, body, link || null);
}

module.exports = { listNotifications, createNotification, markRead, markAllRead, broadcast };
