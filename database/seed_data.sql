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
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, approval_threshold, description, is_flagged) VALUES
  (1, 45000, 'INV-2024-001', '2024-01-05', 100000, 'Office laptops Q1', 0),
  (1, 78000, 'INV-2024-002', '2024-02-10', 100000, 'Server hardware', 0),
  (2, 12500, 'INV-2024-003', '2024-01-12', 100000, 'Stationery supplies', 0),
  (3, 55000, 'INV-2024-004', '2024-01-20', 100000, 'Logistics Q1', 0);

-- SPLIT INVOICE TRANSACTIONS (vendor 4 - Ghost: Nexus Trade)
-- Same vendor, same month, 3 invoices each just under 50k threshold
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (4, 49500, 'NTE-2024-101', '2024-03-02', 50000, 'Consultancy services Jan', 1, 'SPLIT_INVOICE'),
  (4, 49800, 'NTE-2024-102', '2024-03-08', 50000, 'Consultancy services Feb', 1, 'SPLIT_INVOICE'),
  (4, 48900, 'NTE-2024-103', '2024-03-14', 50000, 'Consultancy services Mar', 1, 'SPLIT_INVOICE'),
  (4, 49200, 'NTE-2024-104', '2024-03-21', 50000, 'Consultancy services misc', 1, 'SPLIT_INVOICE');

-- SPLIT INVOICE TRANSACTIONS (vendor 5 - Ghost: Global Infra)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (5, 99100, 'GIS-2024-201', '2024-04-03', 100000, 'Infrastructure audit', 1, 'SPLIT_INVOICE'),
  (5, 99500, 'GIS-2024-202', '2024-04-09', 100000, 'Infrastructure review', 1, 'SPLIT_INVOICE'),
  (5, 98800, 'GIS-2024-203', '2024-04-17', 100000, 'Infrastructure compliance', 1, 'SPLIT_INVOICE');

-- CIRCULAR / ROUND-TRIPPING (vendor 6 + vendor 7 pay each other)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (6, 200000, 'PC-2024-301', '2024-05-01', 500000, 'Project management services', 1, 'ROUND_TRIPPING'),
  (7, 195000, 'VC-2024-401', '2024-05-04', 500000, 'Sub-contracting fees', 1, 'ROUND_TRIPPING');

-- GHOST VENDOR TRANSACTIONS (vendor 4 used for additional payments)
INSERT OR IGNORE INTO transactions (vendor_id, amount, invoice_number, invoice_date, approval_threshold, description, is_flagged, flag_reason) VALUES
  (4, 75000, 'NTE-2024-105', '2024-06-10', 100000, 'Advisory retainer June', 1, 'GHOST_VENDOR'),
  (7, 150000, 'VC-2024-402', '2024-06-15', 200000, 'Technology licensing', 1, 'GHOST_VENDOR');
