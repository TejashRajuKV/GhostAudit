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
    
    // Add performance indexes if they don't exist
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_vendor_id ON transactions(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_invoice_date ON transactions(invoice_date);
        CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
        CREATE INDEX IF NOT EXISTS idx_transactions_is_flagged ON transactions(is_flagged);
        CREATE INDEX IF NOT EXISTS idx_cases_vendor_id ON cases(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_cases_fraud_type ON cases(fraud_type);
        CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
        CREATE INDEX IF NOT EXISTS idx_cases_confidence ON cases(confidence);
        CREATE INDEX IF NOT EXISTS idx_vendors_ghost_score ON vendors(ghost_score);
        CREATE INDEX IF NOT EXISTS idx_verdicts_case_id ON verdicts(case_id);
      `);
      console.log('✅ Database indexes created');
    } catch (err) {
      console.error('Error creating indexes:', err.message);
    }

    // Lightweight migrations: add columns introduced after first release
    try {
      const cols = db.prepare("PRAGMA table_info(cases)").all().map(c => c.name);
      if (!cols.includes('assigned_to')) db.exec('ALTER TABLE cases ADD COLUMN assigned_to TEXT');
    } catch (err) {
      console.error('Migration warning:', err.message);
    }
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
