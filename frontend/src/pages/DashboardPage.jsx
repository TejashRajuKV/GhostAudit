import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesApi } from '../apiClient';

import { ModeContext } from '../App';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const fraudLabel = { SPLIT_INVOICE: 'Split Invoice', ROUND_TRIPPING: 'Round-Tripping', GHOST_VENDOR: 'Ghost Vendor', DELAYED_PAYMENT: 'Delayed Payment' };

function ConfidenceBar({ value }) {
  const cls = value >= 75 ? 'conf-high' : value >= 50 ? 'conf-medium' : 'conf-low';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="confidence-bar" style={{ flex: 1 }}>
        <div className={`confidence-fill ${cls}`} style={{ width: `${value}%` }} />
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', width: 34 }}>{value}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, ghost: 0, split: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanMsg, setScanMsg] = useState('');
  const navigate = useNavigate();
  const { smeMode } = React.useContext(ModeContext);

  const loadCases = async () => {
    try {
      const res = await casesApi.list();
      const data = res.data;
      setCases(data);
      setStats({
        total: data.length,
        critical: data.filter(c => c.severity === 'CRITICAL' || c.severity === 'HIGH').length,
        ghost: data.filter(c => c.fraud_type === 'GHOST_VENDOR').length,
        split: data.filter(c => c.fraud_type === 'SPLIT_INVOICE' || c.fraud_type === 'ROUND_TRIPPING').length,
      });
    } catch {
      setError('Failed to load cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCases(); }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanMsg('');
    setError('');
    try {
      const res = await casesApi.scan();
      setScanMsg(`✅ Scan complete — ${res.data.newCasesFound} new case(s) found.`);
      loadCases();
    } catch (err) {
      setError(err.response?.data?.error || 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const severityBadge = (s) => {
    const cls = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
    return <span className={`badge ${cls[s] || 'badge-medium'}`}>{s}</span>;
  };

  const statusBadge = (s) => {
    const cls = { OPEN: 'badge-open', ANALYZED: 'badge-analyzed', CONFIRMED: 'badge-confirmed', DISMISSED: 'badge-dismissed' };
    return <span className={`badge ${cls[s] || 'badge-open'}`}>{s}</span>;
  };

  const sortedCases = [...cases].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Triage Dashboard</h1>
          <p className="page-subtitle">Flagged cases ranked by severity — powered by Gemma AI</p>
        </div>
        <div className="flex gap-12 items-center">
          <button
            id="scan-btn"
            className={`btn btn-primary scan-btn ${scanning ? 'scanning' : ''}`}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? <><span className="spinner spinner-sm" /> Scanning...</> : '🔍 Run Detection Scan'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {scanMsg && <div style={{ background: 'var(--success-dim)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--success)', marginBottom: 16 }}>{scanMsg}</div>}

      <div className="stats-grid stagger">
        <div className="stat-card">
          <div className="stat-label">Total Cases</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">Flagged this session</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{smeMode ? 'Urgent Attention' : 'High / Critical'}</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.critical}</div>
          <div className="stat-sub">Require immediate review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{smeMode ? 'Fake Suppliers' : 'Ghost Vendors'}</div>
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{stats.ghost}</div>
          <div className="stat-sub">Shell company flags</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{smeMode ? 'Policy Breaches' : 'Invoice Fraud'}</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.split}</div>
          <div className="stat-sub">Split / round-tripping</div>
        </div>
      </div>

      <div className="card fade-in-up">
        <div className="card-header">
          <h2 style={{ fontSize: '1rem' }}>⚖️ Flagged Cases</h2>
          <span className="badge badge-open">{cases.length} cases</span>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /><p>Loading cases...</p></div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No cases yet</h3>
            <p className="text-muted">Click "Run Detection Scan" to analyze transactions</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Fraud Type</th>
                  <th>Severity</th>
                  {!smeMode && <th>Confidence</th>}
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedCases.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.vendor_name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{c.gstin || 'No GSTIN'}</div>
                    </td>
                    <td>
                      <span className={`fraud-tag fraud-${c.fraud_type}`}>{fraudLabel[c.fraud_type] || c.fraud_type}</span>
                    </td>
                    <td>{severityBadge(c.severity)}</td>
                    {!smeMode && <td style={{ minWidth: 160 }}><ConfidenceBar value={c.confidence} /></td>}
                    <td>{statusBadge(c.status)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); navigate(`/cases/${c.id}`); }}
                      >
                        Investigate →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
