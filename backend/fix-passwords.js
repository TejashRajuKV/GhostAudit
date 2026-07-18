const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

async function fixPasswords() {
  const db = new Database(path.resolve(__dirname, '../database/ghostaudit.db'));
  const hash = await bcrypt.hash('ghostaudit123', 10);
  console.log('Generated hash:', hash);

  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'admin@ghostaudit.ai');
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'reviewer@ghostaudit.ai');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@ghostaudit.ai');
  const ok = await bcrypt.compare('ghostaudit123', user.password_hash);
  console.log('Password verify after fix:', ok);
  console.log('Done!');
  db.close();
}

fixPasswords();
