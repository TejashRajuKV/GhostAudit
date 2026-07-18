-- GhostAudit Mock Seed Data
-- Includes: ghost vendors, legitimate vendors, split invoice transactions, circular transactions

-- Seed admin user (password: ghostaudit123)
INSERT OR IGNORE INTO users (email, password_hash, role) VALUES
  ('admin@ghostaudit.ai', '$2b$10$hknyHwz21EUzaJBLsn6iC.1uokHPIVf.vJ9JGZ5QxMBaxGYXI306C', 'admin'),
  ('reviewer@ghostaudit.ai', '$2b$10$hknyHwz21EUzaJBLsn6iC.1uokHPIVf.vJ9JGZ5QxMBaxGYXI306C', 'reviewer');

-- LEGITIMATE VENDORS
INSERT OR IGNORE INTO vendors (id, name, gstin, address, bank_account, is_ghost, ghost_score) VALUES
  (1, 'TechSupply Solutions Pvt Ltd', '29AABCT1332L1ZX', '45 MG Road, Bengaluru, Karnataka 560001', '1234567890123456', 0, 8),
  (2, 'Meridian Office Supplies', '27AAACM2687K1ZP', '12 Nariman Point, Mumbai, Maharashtra 400021', '9876543210987654', 0, 12),
  (3, 'Apex Logistics & Transport', '06AABCA4342L1ZK', '78 Sector 18, Gurugram, Haryana 122001', '1122334455667788', 0, 15);

-- GHOST / SHELL VENDORS  
INSERT OR IGNORE INTO vendors (id, name, gstin, address, bank_account, is_ghost, ghost_score) VALUES
  (4, 'Nexus Trade Enterprises', '11AAACN9999X1ZQ', 'Shop 3', '1111111111111111', 1, 92),
  (5, 'Global Infra Services', 'INVALIDGSTIN001', '2nd Floor', '2222222222222222', 1, 88),
  (6, 'Pinnacle Consultants', '27AAACP1111K1ZZ', 'Office complex, city', '1234123412341234', 1, 78),
  (7, 'Vertex Commerce Ltd', '29AABCV0000L1ZA', 'Near market', '9999999999999999', 1, 85);

-- NORMAL TRANSACTIONS (legitimate)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged) VALUES
  (1, 45000, 'INV-2024-001', '2024-01-05', '2024-01-10', 100000, 'Office laptops Q1', 0),
  (1, 78000, 'INV-2024-002', '2024-02-10', '2024-02-15', 100000, 'Server hardware', 0),
  (2, 12500, 'INV-2024-003', '2024-01-12', '2024-01-15', 100000, 'Stationery supplies', 0),
  (3, 55000, 'INV-2024-004', '2024-01-20', '2024-01-25', 100000, 'Logistics Q1', 0);

-- SPLIT INVOICE TRANSACTIONS (vendor 4 - Ghost: Nexus Trade)
-- Same vendor, same month, 3 invoices each just under 50k threshold
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (4, 49500, 'NTE-2024-101', '2024-03-02', '2024-03-05', 50000, 'Consultancy services Jan', 1, 'SPLIT_INVOICE'),
  (4, 49800, 'NTE-2024-102', '2024-03-08', '2024-03-10', 50000, 'Consultancy services Feb', 1, 'SPLIT_INVOICE'),
  (4, 48900, 'NTE-2024-103', '2024-03-14', '2024-03-18', 50000, 'Consultancy services Mar', 1, 'SPLIT_INVOICE'),
  (4, 49200, 'NTE-2024-104', '2024-03-21', '2024-03-25', 50000, 'Consultancy services misc', 1, 'SPLIT_INVOICE');

-- SPLIT INVOICE TRANSACTIONS (vendor 5 - Ghost: Global Infra)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (5, 99100, 'GIS-2024-201', '2024-04-03', '2024-04-05', 100000, 'Infrastructure audit', 1, 'SPLIT_INVOICE'),
  (5, 99500, 'GIS-2024-202', '2024-04-09', '2024-04-12', 100000, 'Infrastructure review', 1, 'SPLIT_INVOICE'),
  (5, 98800, 'GIS-2024-203', '2024-04-17', '2024-04-20', 100000, 'Infrastructure compliance', 1, 'SPLIT_INVOICE');

-- CIRCULAR / ROUND-TRIPPING (vendor 6 + vendor 7 pay each other)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (6, 200000, 'PC-2024-301', '2024-05-01', '2024-05-02', 500000, 'Project management services', 1, 'ROUND_TRIPPING'),
  (7, 195000, 'VC-2024-401', '2024-05-04', '2024-05-05', 500000, 'Sub-contracting fees', 1, 'ROUND_TRIPPING');

-- GHOST VENDOR TRANSACTIONS (vendor 4 used for additional payments)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (4, 75000, 'NTE-2024-105', '2024-06-10', '2024-06-12', 100000, 'Advisory retainer June', 1, 'GHOST_VENDOR'),
  (7, 150000, 'VC-2024-402', '2024-06-15', '2024-06-20', 200000, 'Technology licensing', 1, 'GHOST_VENDOR');

-- DELAYED PAYMENT TRANSACTIONS (MSME 45-day violation - Vendor 2 is MSME)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (2, 45000, 'INV-2024-004', '2024-07-01', '2024-08-25', 100000, 'Bulk stationery supplies', 1, 'DELAYED_PAYMENT');

-- EXTRA 25 TRANSACTIONS (MIXED)
-- Legitimate (15)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (1, 32000, 'INV-2024-005', '2024-08-01', '2024-08-05', 100000, 'Mouse and keyboards', 0, NULL),
  (1, 41000, 'INV-2024-006', '2024-08-15', '2024-08-20', 100000, 'Monitors', 0, NULL),
  (1, 28500, 'INV-2024-007', '2024-09-02', '2024-09-06', 100000, 'Cables and adapters', 0, NULL),
  (1, 65000, 'INV-2024-008', '2024-09-18', '2024-09-22', 100000, 'Developer machines', 0, NULL),
  (1, 15000, 'INV-2024-009', '2024-10-01', '2024-10-05', 100000, 'Networking gear', 0, NULL),
  
  (2, 18000, 'INV-2024-010', '2024-08-05', '2024-08-10', 100000, 'Printer ink', 0, NULL),
  (2, 22000, 'INV-2024-011', '2024-08-25', '2024-08-30', 100000, 'Paper stock', 0, NULL),
  (2, 11500, 'INV-2024-012', '2024-09-10', '2024-09-15', 100000, 'Whiteboards', 0, NULL),
  (2, 14000, 'INV-2024-013', '2024-09-25', '2024-09-30', 100000, 'Markers and erasers', 0, NULL),
  (2, 25000, 'INV-2024-014', '2024-10-10', '2024-10-15', 100000, 'Binding materials', 0, NULL),
  
  (3, 42000, 'INV-2024-015', '2024-08-12', '2024-08-18', 100000, 'Transport route A', 0, NULL),
  (3, 51000, 'INV-2024-016', '2024-08-28', '2024-09-03', 100000, 'Transport route B', 0, NULL),
  (3, 48000, 'INV-2024-017', '2024-09-15', '2024-09-21', 100000, 'Transport route C', 0, NULL),
  (3, 59000, 'INV-2024-018', '2024-10-05', '2024-10-10', 100000, 'Warehouse transfer', 0, NULL),
  (3, 41500, 'INV-2024-019', '2024-10-20', '2024-10-25', 100000, 'Last mile delivery', 0, NULL);

-- Anomalies (10)
-- 1. Split Invoice (4 txns)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (4, 49900, 'NTE-2024-106', '2024-07-02', '2024-07-05', 50000, 'July consulting P1', 1, 'SPLIT_INVOICE'),
  (4, 49750, 'NTE-2024-107', '2024-07-10', '2024-07-12', 50000, 'July consulting P2', 1, 'SPLIT_INVOICE'),
  (4, 49100, 'NTE-2024-108', '2024-07-18', '2024-07-20', 50000, 'July consulting P3', 1, 'SPLIT_INVOICE'),
  (4, 48800, 'NTE-2024-109', '2024-07-26', '2024-07-28', 50000, 'July consulting P4', 1, 'SPLIT_INVOICE');

-- 2. Circular / Round-Tripping (2 txns)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (6, 120000, 'PC-2024-302', '2024-08-01', '2024-08-02', 500000, 'Market research', 1, 'ROUND_TRIPPING'),
  (7, 118000, 'VC-2024-403', '2024-08-05', '2024-08-06', 500000, 'Data sharing fee', 1, 'ROUND_TRIPPING');

-- 3. Delayed Payment (1 txn)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (2, 35000, 'INV-2024-020', '2024-09-01', '2024-10-25', 100000, 'Office chairs', 1, 'DELAYED_PAYMENT');

-- 4. Ghost Vendor Large Txns (3 txns)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, payment_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (5, 250000, 'GIS-2024-204', '2024-09-10', '2024-09-15', 500000, 'Facility upgrade', 1, 'GHOST_VENDOR'),
  (5, 275000, 'GIS-2024-205', '2024-10-12', '2024-10-18', 500000, 'Network cabling', 1, 'GHOST_VENDOR'),
  (5, 210000, 'GIS-2024-206', '2024-11-05', '2024-11-10', 500000, 'Security audit', 1, 'GHOST_VENDOR');
