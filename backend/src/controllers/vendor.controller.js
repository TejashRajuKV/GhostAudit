const { getDb } = require('../db');

function getVendors(req, res) {
  try {
    const db = getDb();
    const vendors = db.prepare(`
      SELECT 
        v.*,
        COUNT(t.id) as total_tx_count,
        SUM(t.amount) as total_tx_amount,
        SUM(CASE WHEN t.is_flagged = 1 THEN 1 ELSE 0 END) as flagged_tx_count
      FROM vendors v
      LEFT JOIN transactions t ON v.id = t.vendor_id
      GROUP BY v.id
      ORDER BY v.name ASC
    `).all();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors', details: err.message });
  }
}

function verifyGst(req, res) {
  try {
    const db = getDb();
    const vendorId = req.params.id;
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
    
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    
    // Mock registry logic based on vendor properties
    let status = 'ACTIVE';
    let legalName = vendor.name;
    let flags = [];
    
    if (vendor.gstin === 'INVALIDGSTIN001' || !vendor.gstin || vendor.gstin.length !== 15) {
      status = 'SUSPENDED';
      flags.push('INVALID_FORMAT');
    }
    
    if (vendor.is_ghost === 1) {
      status = 'CANCELED_SUO_MOTO';
      legalName = 'Mismatched Fake Entity Pvt Ltd';
      flags.push('ADDRESS_NOT_VERIFIED');
      flags.push('NON_FILER_6_MONTHS');
    }
    
    const registryData = {
      gstin: vendor.gstin,
      official_legal_name: legalName,
      status: status,
      registration_date: '2019-04-12',
      tax_flags: flags,
      verified_at: new Date().toISOString()
    };
    
    res.json(registryData);
  } catch (err) {
    res.status(500).json({ error: 'GST verification failed', details: err.message });
  }
}

module.exports = { getVendors, verifyGst };
