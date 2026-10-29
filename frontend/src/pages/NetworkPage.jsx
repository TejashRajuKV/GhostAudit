import React, { useState, useEffect, useRef } from 'react';
import { networkApi } from '../apiClient';

// Lightweight SVG force-ish layout: ring placement + a few relaxation passes (no external graph lib)
function layout(nodes, edges, width, height) {
  const pos = {};
  const n = nodes.length || 1;
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.min(width, height) * 0.36;
    pos[node.id] = { x: width / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle) };
  });
  const idx = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
  for (let iter = 0; iter < 120; iter++) {
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 1;
        const f = 900 / d2;
        a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
      }
    }
    // spring attraction along edges
    for (const e of edges) {
      const a = pos[e.source], b = pos[e.target];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      a.x += dx * 0.02; a.y += dy * 0.02;
      b.x -= dx * 0.02; b.y -= dy * 0.02;
    }
    // bounds
    for (const node of nodes) {
      const p = pos[node.id];
      p.x = Math.max(50, Math.min(width - 50, p.x));
      p.y = Math.max(50, Math.min(height - 70, p.y));
    }
  }
  return pos;
}

export default function NetworkPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);
  const W = 900, H = 560;

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await networkApi.get();
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load network');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pos = data ? layout(data.nodes, data.edges, W, H) : {};

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (error) return <div className="error-banner">⚠️ {error} <button className="btn btn-ghost btn-sm" onClick={load}>Retry</button></div>;
  if (!data || !data.nodes.length) return <div className="empty-state"><div className="empty-icon">🕸️</div><p>No vendor transaction links yet. Import transactions first.</p></div>;

  const edgeColor = { STRONG: 'var(--danger)', MODERATE: '#f59e0b', WEAK: 'var(--text-muted)' };

  return (
    <div className="page-container fade-in-up">
      <div className="page-header">
        <div>
          <h1>🕸️ Vendor Collusion Network</h1>
          <p className="page-subtitle">{data.summary}</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Rebuild</button>
      </div>

      {data.rings.filter(r => r.size >= 2).length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {data.rings.map((r, i) => (
            <div key={i} className={`card ${r.hasGhost ? 'card-danger' : ''}`} style={{ padding: '10px 14px', fontSize: '0.82rem' }}>
              <strong>{r.hasGhost ? '🚨 Collusion ring #' + (i + 1) : '🔗 Cluster #' + (i + 1)}</strong>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{r.members.join(' ↔ ')}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minHeight: 420 }}>
          {data.edges.map((e, i) => {
            const a = pos[e.source], b = pos[e.target];
            if (!a || !b) return null;
            const active = hovered === e.source || hovered === e.target;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={edgeColor[e.strength] || '#888'}
                  strokeWidth={active ? Math.max(2, e.weight) : 1.5}
                  strokeOpacity={active ? 0.95 : 0.45}
                  strokeDasharray={e.type === 'SHARED_ATTRIBUTE' ? '6 3' : undefined} />
                {active && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="11" fill="var(--text-primary)">
                    {e.type === 'ROUND_TRIPPING' ? `${e.matches || e.weight} matched payment(s)` : (e.reasons || []).join(', ')}
                  </text>
                )}
              </g>
            );
          })}
          {data.nodes.map(n => {
            const p = pos[n.id];
            const ghost = n.is_ghost || n.ghost_score >= 70;
            const color = ghost ? 'var(--danger)' : n.degree > 0 ? '#f59e0b' : 'var(--success)';
            const r = 14 + Math.min(14, Math.sqrt(n.totalSpend || 0) / 260);
            return (
              <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={hovered === n.id ? 0.95 : 0.7}
                  stroke="var(--border)" strokeWidth="1.5" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="13">{ghost ? '👻' : '🏢'}</text>
                <text x={p.x} y={p.y + r + 14} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
                  {n.name.length > 22 ? n.name.slice(0, 20) + '…' : n.name}
                </text>
                {hovered === n.id && (
                  <text x={p.x} y={p.y - r - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-primary)">
                    ₹{Math.round(n.totalSpend).toLocaleString('en-IN')} · {n.txCount} txns · links: {n.degree}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="card" style={{ marginTop: 16, padding: '14px 18px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Legend:</strong>{' '}
        🔴 ghost/suspected vendor · 🟠 linked vendor · 🟢 clean vendor · solid line = round-tripping payments · dashed line = shared bank account/address · node size = total spend
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Suspicious Links ({data.edges.length})</h3>
        {data.edges.length === 0 ? <p className="page-subtitle">No cross-vendor anomalies detected.</p> : (
          <table className="table">
            <thead><tr><th>Vendor A</th><th>Vendor B</th><th>Type</th><th>Strength</th><th>Evidence</th></tr></thead>
            <tbody>
              {data.edges.map((e, i) => {
                const na = data.nodes.find(n => n.id === e.source)?.name;
                const nb = data.nodes.find(n => n.id === e.target)?.name;
                return (
                  <tr key={i}>
                    <td>{na}</td><td>{nb}</td>
                    <td>{e.type === 'ROUND_TRIPPING' ? '🔁 Round-tripping' : '🧬 Shared attribute'}</td>
                    <td><span className={`badge badge-${e.strength === 'STRONG' ? 'danger' : e.strength === 'MODERATE' ? 'warning' : 'muted'}`}>{e.strength}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {e.type === 'ROUND_TRIPPING'
                        ? (e.samples || []).map((s, j) => <div key={j}>{s.a} ↔ {s.b} (₹{s.amountA.toLocaleString('en-IN')}, {s.daysApart}d apart)</div>)
                        : (e.reasons || []).join('; ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
