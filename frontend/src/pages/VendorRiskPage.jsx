import React, { useState, useEffect } from 'react';
import { vendorsApi } from '../apiClient';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function VendorRiskPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [verifyingId, setVerifyingId] = useState(null);
  const [registryData, setRegistryData] = useState({}); // mapped by vendorId

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await vendorsApi.getAll();
      setVendors(res.data);
    } catch (err) {
      setError('Failed to fetch vendors.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGst = async (vendorId) => {
    setVerifyingId(vendorId);
    try {
      const res = await vendorsApi.verifyGst(vendorId);
      setRegistryData(prev => ({ ...prev, [vendorId]: res.data }));
    } catch (err) {
      console.error(err);
      setRegistryData(prev => ({ ...prev, [vendorId]: { error: 'Failed to verify GST' } }));
    } finally {
      setVerifyingId(null);
    }
  };

  const getRiskBadge = (score) => {
    if (score >= 70) return <span className="badge badge-critical">HIGH RISK ({score})</span>;
    if (score >= 40) return <span className="badge badge-high">MEDIUM RISK ({score})</span>;
    return <span className="badge badge-low">LOW RISK ({score})</span>;
  };

  if (loading) return <div className="loading-state"><div className="spinner" /><p>Loading risk profiles...</p></div>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="fade-in stagger">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Risk & Registry</h1>
          <p className="page-subtitle">Analyze vendor risk profiles and verify GST credentials directly with the registry.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Active Vendors ({vendors.length})</h3>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Risk Profile</th>
                  <th>Transaction Vol.</th>
                  <th>Flagged Txns</th>
                  <th>GSTIN Verification</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => {
                  const gstData = registryData[v.id];
                  return (
                    <React.Fragment key={v.id}>
                      <tr>
                        <td>
                          <strong>{v.name}</strong>
                          <br/>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{v.address}</span>
                        </td>
                        <td>{getRiskBadge(v.ghost_score)}</td>
                        <td>
                          {v.total_tx_count} txns
                          <br/>
                          <span className="mono">₹{v.total_tx_amount?.toLocaleString('en-IN') || 0}</span>
                        </td>
                        <td>
                          {v.flagged_tx_count > 0 ? (
                            <span className="text-danger" style={{ fontWeight: 600 }}>{v.flagged_tx_count} Flagged</span>
                          ) : (
                            <span className="text-muted">Clean</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="mono">{v.gstin}</span>
                            {!gstData ? (
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => handleVerifyGst(v.id)}
                                disabled={verifyingId === v.id}
                              >
                                {verifyingId === v.id ? 'Verifying...' : 'Verify Registry'}
                              </button>
                            ) : gstData.error ? (
                              <span className="text-danger" style={{ fontSize: '0.85rem' }}>Failed to verify</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: gstData.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }}>
                                {gstData.status === 'ACTIVE' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                                <strong>{gstData.status}</strong>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Row for Registry Details if verified */}
                      {gstData && !gstData.error && (
                        <tr style={{ background: 'var(--bg-input)' }}>
                          <td colSpan="5" style={{ padding: '12px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <div>
                                <span className="text-muted">Official Legal Name:</span> <strong style={{color: gstData.official_legal_name !== v.name ? 'var(--danger)' : 'inherit'}}>{gstData.official_legal_name}</strong>
                              </div>
                              <div>
                                <span className="text-muted">Registration Date:</span> <strong>{gstData.registration_date}</strong>
                              </div>
                              {gstData.tax_flags && gstData.tax_flags.length > 0 && (
                                <div style={{ color: 'var(--danger)' }}>
                                  <strong>Flags:</strong> {gstData.tax_flags.join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
