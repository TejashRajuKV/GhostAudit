import React, { useState, useEffect } from 'react';
import { analyticsApi, casesApi } from '../apiClient';

const TABS = [
  { id: 'benford', label: "📐 Benford's Law" },
  { id: 'duplicates', label: '📑 Duplicate Invoices' },
  { id: 'thresholds', label: '🎯 Threshold Evasion' },
  { id: 'risk', label: '🌡️ Vendor Risk Heatmap' },
  { id: 'accuracy', label: '🎓 AI Calibration' },
  { id: 'msme', label: '⏳ MSME 45-Day Delays' },
  { id: 'drift', label: '📉 Compliance Drift' },
  { id: 'forecast', label: '🌦 Risk Weather' },
  { id: 'peer', label: '👥 Peer Benchmark' },
  { id: 'shadow', label: '🕶 Shadow Procurement' },
];

function Bar({ pct, color }) {
  return (
    <div style={{ background: 'var(--surface-light)', borderRadius: 6, height: 18, position: 'relative', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.75 }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('benford');
  const [data, setData] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (tab === 'accuracy') {
          const res = await casesApi.accuracy();
          if (!dead) setAccuracy(res.data);
        } else {
          const fn = { benford: analyticsApi.benford, duplicates: analyticsApi.duplicates, thresholds: analyticsApi.thresholds, risk: analyticsApi.riskScores, msme: analyticsApi.msmeDelays, drift: analyticsApi.drift, forecast: analyticsApi.forecast, peer: analyticsApi.peerBenchmark, shadow: analyticsApi.shadowProcurement }[tab];
          const res = await fn();
          if (!dead) setData(res.data);
        }
      } catch (e) {
        if (!dead) setError(e.response?.data?.error || 'Analytics failed to load');
      } finally { if (!dead) setLoading(false); }
    };
    load();
    return () => { dead = true; };
  }, [tab]);

  return (
    <div className="page-container fade-in-up">
      <div className="page-header">
        <div>
          <h1>🔬 Fraud Analytics Lab</h1>
          <p className="page-subtitle">Statistical detectors that run beyond rule-based case scanning</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {loading && <div className="loading-state"><div className="spinner" /></div>}
      {error && <div className="error-banner">⚠️ {error}</div>}

      {!loading && tab === 'benford' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 6 }}>Leading-Digit Distribution vs. Benford's Expected Curve</h3>
          <p className="page-subtitle" style={{ marginBottom: 16 }}>{data.summary || `Analyzed ${data.count ?? data.totalCount ?? '—'} transactions`}</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, marginBottom: 8 }}>
            {(data.digits || data.distribution || []).map((d, i) => {
              const digit = d.digit ?? d.d ?? (i + 1);
              const actual = d.actual_pct ?? d.actualPct ?? d.pct ?? 0;
              const expected = d.expected_pct ?? d.expectedPct ?? 0;
              const dev = Math.abs(actual - expected);
              return (
                <div key={digit} style={{ flex: 1, textAlign: 'center' }} title={`Digit ${digit}: actual ${actual}% vs expected ${expected}%`}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 150, justifyContent: 'center' }}>
                    <div style={{ width: 14, height: `${Math.min(100, actual * 2.6)}px`, background: dev > 5 ? 'var(--danger)' : 'var(--primary)', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ width: 14, height: `${Math.min(100, expected * 2.6)}px`, background: 'var(--text-muted)', opacity: 0.5, borderRadius: '3px 3px 0 0' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{digit}</div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Colored bar = actual share · grey bar = Benford expected share. Deviation &gt;5% highlighted red.</p>
          {Array.isArray(data.deviations) && data.deviations.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Largest deviations:</strong>
              <ul>{data.deviations.slice(0, 4).map((dv, i) => <li key={i} style={{ fontSize: '0.85rem' }}>Digit {dv.digit}: {dv.actual_pct ?? dv.actualPct}% actual vs {dv.expected_pct ?? dv.expectedPct}% expected ({dv.direction || ''})</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'duplicates' && data && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>{data.summary}</div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Repeated Invoice Numbers ({(data.exact || []).length})</h3>
            {(data.exact || []).length === 0 ? <p className="page-subtitle">None found ✅</p> : (
              <table className="table">
                <thead><tr><th>Invoice #</th><th>Vendor</th><th>Amounts</th><th>Dates</th></tr></thead>
                <tbody>{(data.exact || []).map((d, i) => (
                  <tr key={i}><td>{d.invoice_number}</td><td>{d.vendor}</td><td>{(d.amounts || []).map(a => `₹${Number(a).toLocaleString('en-IN')}`).join(', ')}</td><td>{(d.dates || []).join(', ')}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Near-Duplicate Payments ({(data.near || []).length})</h3>
            {(data.near || []).length === 0 ? <p className="page-subtitle">None found ✅</p> : (
              <table className="table">
                <thead><tr><th>Vendor</th><th>Invoice A</th><th>Invoice B</th><th>Amount</th><th>Days Apart</th></tr></thead>
                <tbody>{(data.near || []).map((d, i) => (
                  <tr key={i}><td>{d.vendor}</td><td>{d.a?.invoice_number ?? d.invoiceA}</td><td>{d.b?.invoice_number ?? d.invoiceB}</td><td>₹{Number(d.amount ?? d.a?.amount ?? 0).toLocaleString('en-IN')}</td><td>{d.daysApart}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!loading && tab === 'thresholds' && data && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            {data.stats?.note} — just-below-threshold: <strong>{data.stats?.justBelowThresholdPct}%</strong>, round numbers: <strong>{data.stats?.roundNumberPct}%</strong> of {data.stats?.totalTransactions} txns
          </div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Invoices Just Below Approval Limit ({(data.justBelowThreshold || []).length})</h3>
            <table className="table">
              <thead><tr><th>Vendor</th><th>Amount</th><th>Threshold</th><th>Gap</th><th>Date</th></tr></thead>
              <tbody>{(data.justBelowThreshold || []).slice(0, 20).map((d, i) => (
                <tr key={i}><td>{d.vendor}</td><td>₹{d.amount.toLocaleString('en-IN')}</td><td>₹{d.threshold.toLocaleString('en-IN')}</td><td style={{ color: 'var(--danger)', fontWeight: 700 }}>₹{d.gap.toLocaleString('en-IN')}</td><td>{d.date}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {(data.repeatedAmounts || []).length > 0 && (
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Repeated Exact Amounts (≥3 times)</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {data.repeatedAmounts.map((r, i) => (
                  <span key={i} className="badge badge-warning">₹{r.amount.toLocaleString('en-IN')} × {r.count}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'risk' && Array.isArray(data) && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 14 }}>Composite Vendor Risk Scores</h3>
          {data.map(v => (
            <div key={v.vendorId} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                <strong>{v.vendor}</strong>
                <span className={`badge badge-${v.band === 'CRITICAL' ? 'danger' : v.band === 'HIGH' ? 'warning' : v.band === 'MEDIUM' ? 'info' : 'success'}`}>{v.band} · {v.score}/100</span>
              </div>
              <Bar pct={v.score} color={v.score >= 75 ? 'var(--danger)' : v.score >= 50 ? '#f59e0b' : v.score >= 25 ? '#3b82f6' : 'var(--success)'} />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {v.factors.map(f => `${f.name} (+${f.value})`).join(' · ')} — ₹{Math.round(v.totalSpend).toLocaleString('en-IN')} spend / {v.txCount} txns
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'accuracy' && accuracy && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 10 }}>AI vs Human Reviewer Agreement</h3>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: accuracy.agreementRate == null ? 'var(--text-muted)' : accuracy.agreementRate >= 80 ? 'var(--success)' : '#f59e0b' }}>
              {accuracy.agreementRate == null ? '—' : `${accuracy.agreementRate}%`}
            </div>
            <div className="page-subtitle">{accuracy.samples} reviewer decision(s) recorded</div>
          </div>
          <p style={{ fontSize: '0.88rem', background: 'var(--surface-light)', padding: 12, borderRadius: 8 }}>{accuracy.guidance}</p>
          {Object.keys(accuracy.matrix || {}).length > 0 && (
            <table className="table" style={{ marginTop: 14 }}>
              <thead><tr><th>AI Verdict → Human Outcome</th><th>Count</th></tr></thead>
              <tbody>{Object.entries(accuracy.matrix).map(([k, n], i) => <tr key={i}><td>{k}</td><td>{n}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
      {!loading && tab === 'msme' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 6 }}>⏳ {data.rule}</h3>
          <p className="page-subtitle" style={{ marginBottom: 14 }}>{data.total_violations} violation(s) · estimated interest liability ₹{Number(data.total_interest_exposure).toLocaleString('en-IN')}</p>
          <table className="table">
            <thead><tr><th>Vendor</th><th>Invoice</th><th>Amount</th><th>Days Taken</th><th>Overdue By</th><th>Interest ₹</th></tr></thead>
            <tbody>{(data.violations || []).map((v, i) => (
              <tr key={i}><td>{v.vendor_name}</td><td>{v.invoice_number}</td><td>₹{Number(v.amount).toLocaleString('en-IN')}</td>
                <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{v.days_taken}</td><td>{v.days_overdue} days</td><td>₹{Number(v.estimated_interest_liability).toLocaleString('en-IN')}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'drift' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Compliance Drift Status: <span className={`badge badge-${data.drift_status === 'DETERIORATING' ? 'danger' : data.drift_status === 'IMPROVING' ? 'success' : 'info'}`}>{data.drift_status}</span></h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
            {(data.months || []).map(m => (
              <div key={m.month} style={{ flex: 1, textAlign: 'center' }} title={`${m.month}: ${m.flagged}/${m.tx_count} flagged`}>
                <div style={{ height: `${Math.min(100, m.flag_rate * 100)}%`, minHeight: 2, background: m.flag_rate > 0.5 ? 'var(--danger)' : 'var(--primary)', borderRadius: '3px 3px 0 0', margin: '0 auto', width: 18 }} />
                <div style={{ fontSize: '0.65rem', marginTop: 4 }}>{m.month?.slice(2)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Monthly flag rate — a rising trend means controls are eroding over time.</p>
        </div>
      )}

      {!loading && tab === 'forecast' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Financial Weather Forecast: <strong>{data.trend}</strong></h3>
          {(data.forecast || []).length === 0 ? <p className="page-subtitle">Not enough case history to project yet — run more scans.</p> : (
            <table className="table"><thead><tr><th>Horizon</th><th>Predicted New Cases</th></tr></thead>
            <tbody>{data.forecast.map((f, i) => <tr key={i}><td>{f.horizon}</td><td>{f.predicted_new_cases}</td></tr>)}</tbody></table>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Method: {data.method}</p>
        </div>
      )}

      {!loading && tab === 'peer' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Peer Benchmark Anomaly Detection</h3>
          <p className="page-subtitle" style={{ marginBottom: 14 }}>{data.note}</p>
          <table className="table">
            <thead><tr><th>Vendor</th><th>Avg Amt (peer z)</th><th>Flag Rate (peer z)</th><th>Avg Pay Days (peer z)</th></tr></thead>
            <tbody>{(data.vendors || []).map(v => (
              <tr key={v.vendor_id}>
                <td>{v.outlier ? <strong>{v.vendor}</strong> : v.vendor}</td>
                {['avg_amount', 'flag_rate', 'avg_payment_days'].map(k => {
                  const z = v[`${k}_peer_score`]; const hot = z != null && Math.abs(z) > 2;
                  return <td key={k} style={hot ? { color: 'var(--danger)', fontWeight: 700 } : {}}>{z == null ? '—' : `${v[k] != null ? Math.round(v[k] * 100) / 100 : '—'} (${z})`}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'shadow' && data && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 6 }}>🕶 Shadow Procurement Suspects</h3>
          <p className="page-subtitle" style={{ marginBottom: 14 }}>{data.policy}</p>
          {(data.suspects || []).length === 0 ? <p>None found ✅</p> : (data.suspects || []).map((s, i) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 8, borderLeft: '4px solid var(--danger)' }}>
              <strong>{s.vendor}</strong> — {s.reason}<br />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Spend ₹{Number(s.total_spend).toLocaleString('en-IN')} · {s.near_threshold_invoices} near-threshold invoices · verified: {s.is_verified ? 'yes' : 'NO'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
