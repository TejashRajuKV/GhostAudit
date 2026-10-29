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
  payment_date TEXT,
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
  feedback_text TEXT,
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

-- Case workflow history (audit trail of state transitions)
CREATE TABLE IF NOT EXISTS case_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  user_email TEXT,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- Immutable, hash-chained system audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  user_email TEXT,
  details TEXT,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Saved analyzer runs (Benford / duplicates / threshold evasion)
CREATE TABLE IF NOT EXISTS analyzer_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Evidence locker (tamper-evident file attachments per case)
CREATE TABLE IF NOT EXISTS evidence_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT NOT NULL,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ledger chunks for the RAG "Ask your ledger" copilot
CREATE TABLE IF NOT EXISTS policy_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  chunk TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
