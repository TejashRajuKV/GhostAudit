import React, { useState } from 'react';
import { copilotApi } from '../apiClient';

const SUGGESTIONS = [
  'Which vendors have the highest ghost risk?',
  'Show me invoices just below the approval threshold',
  'What is the status of split-invoice cases?',
  'Summarize delayed payment violations',
];

export default function CopilotPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyText, setPolicyText] = useState('');
  const [policies, setPolicies] = useState(null);
  const [ingestMsg, setIngestMsg] = useState(null);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setAsking(true);
    setMessages(m => [...m, { role: 'user', text }]);
    setQuestion('');
    try {
      const res = await copilotApi.ask(text);
      const a = res.data;
      setMessages(m => [...m, {
        role: 'ai',
        text: a.answer,
        source: a._source,
        confidence: a.confidence,
        retrieved: a.retrieved,
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'error', text: e.response?.data?.error || 'Copilot unavailable' }]);
    } finally { setAsking(false); }
  };

  const ingest = async () => {
    if (!policyTitle || !policyText) { setIngestMsg('Title and policy text are required'); return; }
    try {
      const res = await copilotApi.ingestPolicy(policyTitle, policyText);
      setIngestMsg(`✅ Ingested "${policyTitle}" as ${res.data.chunks} retrievable chunk(s)`);
      setPolicyTitle(''); setPolicyText('');
      loadPolicies();
    } catch (e) { setIngestMsg('❌ ' + (e.response?.data?.error || 'Ingest failed')); }
  };

  const loadPolicies = async () => {
    try { const res = await copilotApi.listPolicies(); setPolicies(res.data); } catch { setPolicies([]); }
  };
  React.useEffect(() => { loadPolicies(); }, []);

  return (
    <div className="page-container fade-in-up">
      <div className="page-header">
        <div>
          <h1>💬 Ask Your Ledger</h1>
          <p className="page-subtitle">RAG-grounded copilot — answers cite your own transactions, cases & policies</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* Chat column */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 480 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>👻</div>
                <p>Ask anything about your books. Try:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="btn btn-secondary btn-sm" onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: '0.88rem', whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'var(--primary)' : m.role === 'error' ? 'rgba(239,68,68,0.12)' : 'var(--surface-light)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                }}>
                  {m.text}
                  {m.role === 'ai' && (
                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {m.source === 'gemma' ? '🤖 Gemma reasoning' : m.source === 'mock' ? '🧪 mock mode' : m.source === 'mock_fallback' ? '⚠️ Gemma unavailable — mock fallback' : '🔎 retrieval fallback'}
                      {m.confidence != null && ` · confidence ${m.confidence}%`}
                      {m.retrieved && ` · context: ${m.retrieved.cases} cases, ${m.retrieved.transactions} txns, ${m.retrieved.policies} policy chunks`}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {asking && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}><div className="spinner" style={{ width: 18, height: 18, display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />Investigating your ledger…</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--border)' }}>
            <input className="input" style={{ flex: 1 }} placeholder="e.g. Which vendor has the most threshold-bypass invoices?"
              value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()} />
            <button className="btn btn-primary" onClick={() => ask()} disabled={asking}>Ask</button>
          </div>
        </div>

        {/* Policy RAG column */}
        <div>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginBottom: 10 }}>📚 Policy Knowledge Base</h3>
            <p className="page-subtitle" style={{ marginBottom: 12 }}>Paste internal policies or compliance rules — they become searchable context for answers.</p>
            <input className="input" style={{ marginBottom: 8 }} placeholder="Policy title (e.g. Payment Approval SOP)" value={policyTitle} onChange={e => setPolicyTitle(e.target.value)} />
            <textarea className="input" rows={6} placeholder="Paste policy text…" value={policyText} onChange={e => setPolicyText(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn btn-primary w-full" onClick={ingest}>Ingest Policy</button>
            {ingestMsg && <p style={{ fontSize: '0.8rem', marginTop: 8 }}>{ingestMsg}</p>}
          </div>
          {policies && policies.length > 0 && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <h3 style={{ marginBottom: 10 }}>Indexed Chunks ({policies.length})</h3>
              {policies.slice(0, 8).map(p => (
                <div key={p.id} style={{ marginBottom: 10, fontSize: '0.78rem' }}>
                  <strong>{p.title}</strong>
                  <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.preview}…</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
