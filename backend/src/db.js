const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = path.resolve(__dirname, '../../database/ghostaudit.db');
const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema.sql');
const SEED_PATH = path.resolve(__dirname, '../../database/seed_data.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDb() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  // Only seed if vendors table is empty
  const count = database.prepare('SELECT COUNT(*) as c FROM vendors').get();
  if (count.c === 0) {
    // Seed vendors + transactions from SQL file (no user rows in SQL — done below with real hash)
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    // Strip user INSERT lines from SQL (we insert with real hash below)
    const seedNoUsers = seed.replace(/INSERT OR IGNORE INTO users[\s\S]*?;/g, '');
    database.exec(seedNoUsers);
    console.log('✅ Database seeded with mock data');
  } else {
    console.log('✅ Database already seeded, skipping vendors');
  }

  // Always ensure demo users exist with a correct hash
  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const hash = await bcrypt.hash('ghostaudit123', 10);
    database.prepare(
      "INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)"
    ).run('admin@ghostaudit.ai', hash, 'admin');
    database.prepare(
      "INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)"
    ).run('reviewer@ghostaudit.ai', hash, 'reviewer');
    console.log('✅ Demo users created (ghostaudit123)');
  }
}

module.exports = { getDb, initDb };
