import React, { useState } from 'react';
import api from '../apiClient';

// ── Tier 3 Advanced Intelligence Lab ───────────────────────────
const GETS = [
  { id: 'reverse', label: '🔮 Reverse Audit', fn: () => api.get('/api/v1/intel/reverse-audit') },
  { id: 'behavioral', label: '📈 Behavioral Monitoring', fn: () => api.get('/api/v1/intel/behavioral') },
  { id: 'twin', label: '🪢 Financial Digital Twin', fn: () => api.get('/api/v1/intel/digital-twin') },
  { id: 'regulator', label: '🏛️ Multi-Regulator Dashboard', fn: () => api.get('/api/v1/intel/multi-regulator') },
  { id: 'employee', label: '🕵️ Invisible Employee', fn: () => api.get('/api/v1/intel/invisible-employee') },
  { id: 'coach', label: '🎓 MSME Formalization Coach', fn: () => api.get('/api/v1/intel/msme-coach') },
  { id: 'clone', label: '🧠 Investigator Clone Queue', fn: () => api.get('/api/v1/intel/clone-queue') },
];
const POSTS = [
  { id: 'shock', label: '⚡ Regulatory Shock Simulator', url: '/api/v1/intel/shock-simulator',
    fields: [{ key: 'preset', type: 'select', options: ['LOWER_TDS_THRESHOLD', 'STRICT_45_DAY', 'GST_RATE_HIKE', 'CASH_LIMIT', 'APPROVAL_DROP'] }] },
  { id: 'adshield', label: '📢 Ad-Shield Compliance Auditor', url: '/api/v1/intel/ad-shield',
    fields: [{ key: 'text', type: 'textarea', placeholder: 'Paste marketing copy / ad text…' }] },
  { id: 'dark', label: '🌑 Dark Pattern Auditor', url: '/api/v1/intel/dark-patterns',
    fields: [{ key: 'description', type: 'textarea', placeholder: 'Describe the app flow / checkout UX…' }] },
  { id: 'collateral', label: '🏦 Collateral Loan Auditor', url: '/api/v1/intel/collateral-audit',
    fields: [
      { key: 'documents', type: 'text', placeholder: 'Comma-separated docs (Title Deed, Valuation Report…)' },
      { key: 'loan_amount', type: 'number', placeholder: 'Loan amount ₹' },
      { key: 'market_value', type: 'number', placeholder: 'Market value ₹' },
    ] },
  { id: 'hsn', label: '🚢 HSN / Customs Compliance', url: '/api/v1/intel/hsn-compliance',
    fields: [{ key: 'records', type: 'json', placeholder: '[{"hsn":"6109","gst_rate":12,"export":true}]' }] },
  { id: 'chat', label: '💬 WhatsApp/Email Compliance', url: '/api/v1/intel/chat-compliance',
    fields: [{ key: 'transcript', type: 'textarea', placeholder: 'Paste chat/email transcript…' }] },
  { id: 'contract', label: '📝 Verbal vs Written Contract', url: '/api/v1/intel/contract-vs-verbal',
    fields: [
      { key: 'contract', type: 'textarea', placeholder: 'Contract clauses…' },
      { key: 'transcript', type: 'textarea', placeholder: 'Verbal / chat transcript…' },
    ] },
];

function Result({ data }) {
  if (!data) return null;
  const pretty = JSON.stringify(data, null, 2);
  const verdict = data.verdict || data.risk || data.impact_verdict || data.recommendation || data.advice || null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {verdict && <div className="alert alert-info" style={{ marginBottom: 12 }}>{String(verdict)}</div>}
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.78rem', maxHeight: 420, overflow: 'auto' }}>{pretty}</pre>
    </div>
  );
}

export default function IntelLabPage() {
  const [tab, setTab] = useState('reverse');
  const [inputs, setInputs] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runGet = async (cfg) => {
    setLoading(true); setError(null); setData(null);
    try { const res = await cfg.fn(); setData(res.data); }
    catch (e) { setError(e.response?.data?.message || e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const runPost = async (cfg) => {
    setLoading(true); setError(null); setData(null);
    const body = {};
    for (const f of cfg.fields) {
      const raw = inputs[cfg.id + '.' + f.key];
      if (raw == null || raw === '') continue;
      if (f.type === 'json') { try { body[f.key] = JSON.parse(raw); } catch { setError(`Invalid JSON in ${f.key}`); setLoading(false); return; } }
      else if (f.type === 'number') body[f.key] = Number(raw);
      else if (f.type === 'text' && f.placeholder?.includes('Comma')) body[f.key] = raw.split(',').map(s => s.trim()).filter(Boolean);
      else body[f.key] = raw;
    }
    try { const res = await api.post(cfg.url, body); setData(res.data); }
    catch (e) { setError(e.response?.data?.message || e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const active = [...GETS, ...POSTS].find(x => x.id === tab);
  const isPost = POSTS.some(p => p.id === tab);

  return (
    <div className="page-container fade-in-up">
      <div className="page-header">
        <div>
          <h1>🧪 Advanced Intelligence Lab</h1>
          <p className="page-subtitle">Tier 3 — predictive, behavioral & cross-channel compliance auditors</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[...GETS, ...POSTS].map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setTab(t.id); setData(null); setError(null); if (GETS.some(g => g.id === t.id)) runGet(t); }}>
            {t.label}
          </button>
        ))}
      </div>

      {isPost && active && (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.key}</label>
              {f.type === 'select' ? (
                <select className="input" value={inputs[active.id + '.' + f.key] || ''}
                  onChange={e => setInputs(s => ({ ...s, [active.id + '.' + f.key]: e.target.value }))}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea className="input" rows={4} placeholder={f.placeholder}
                  value={inputs[active.id + '.' + f.key] || ''}
                  onChange={e => setInputs(s => ({ ...s, [active.id + '.' + f.key]: e.target.value }))} />
              ) : (
                <input className="input" type={f.type} placeholder={f.placeholder}
                  value={inputs[active.id + '.' + f.key] || ''}
                  onChange={e => setInputs(s => ({ ...s, [active.id + '.' + f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={() => runPost(active)} disabled={loading}>▶ Run Analysis</button>
        </div>
      )}

      {loading && <div className="loading-state"><div className="spinner" /></div>}
      {error && <div className="error-banner">⚠️ {error}</div>}
      {!loading && <Result data={data} />}
    </div>
  );
}
