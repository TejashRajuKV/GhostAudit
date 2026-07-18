-- GhostAudit Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'reviewer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  bank_account TEXT,
  is_ghost INTEGER DEFAULT 0,
  ghost_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  invoice_number TEXT,
  invoice_date TEXT,
  approval_threshold REAL DEFAULT 100000,
  description TEXT,
  is_flagged INTEGER DEFAULT 0,
  flag_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER,
  transaction_ids TEXT,
  fraud_type TEXT NOT NULL,
  severity TEXT DEFAULT 'MEDIUM',
  confidence INTEGER DEFAULT 50,
  status TEXT DEFAULT 'OPEN',
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER UNIQUE NOT NULL,
  risk_replay TEXT,
  evidence TEXT,
  defense TEXT,
  verdict TEXT,
  verdict_reasoning TEXT,
  confidence INTEGER,
  explanation TEXT,
  report_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  executive_summary TEXT,
  findings TEXT,
  risk_rating TEXT,
  recommendations TEXT,
  case_ids TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
