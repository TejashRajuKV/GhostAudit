import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { casesApi } from '../apiClient';

import { ModeContext } from '../App';

const fraudLabel = { SPLIT_INVOICE: 'Split Invoice', ROUND_TRIPPING: 'Round-Tripping', GHOST_VENDOR: 'Ghost Vendor', DELAYED_PAYMENT: 'Delayed Payment' };

function AutoRemediationPanel({ fraudType }) {
  const remedies = {
    SPLIT_INVOICE: 'Recommendation: Enforce strict Purchase Order (PO) matching for this vendor and review approval threshold limits.',
    GHOST_VENDOR: 'Recommendation: Temporarily freeze payments and request physical verification of the business address. Verify GSTIN status on the official portal.',
    ROUND_TRIPPING: 'Recommendation: Flag for internal audit. Review the business necessity of circular transactions between these entities.',
    DELAYED_PAYMENT: 'Recommendation: Expedite payment immediately to avoid MSME interest penalties. Review accounts payable workflow.'
  };

  const remedy = remedies[fraudType];
  if (!remedy) return null;

  return (
    <div className="card mb-24" style={{ border: '1px solid var(--accent-light)' }}>
      <div className="card-header" style={{ background: 'var(--surface-light)' }}>
        <h3 style={{ color: 'var(--accent)' }}>🛡️ Auto-Remediation Agent</h3>
      </div>
      <div className="card-body">
        <p style={{ fontWeight: 600, margin: 0, padding: 8 }}>{remedy}</p>
      </div>
    </div>
  );
}

function RiskReplayTrail({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div>
      {steps.map((s, i) => (
        <div key={i} className="replay-step fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="step-number">{s.step}</div>
          <div className="step-content">
            <div className="step-title">{s.title}</div>
            <div className="step-observation">{s.observation}</div>
            <div className="step-significance">💡 {s.significance}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProsecutorPanel({ evidence, defense, verdict, confidence, reasoning }) {
  const verdictColor = { CONFIRMED_FRAUD: 'var(--danger)', SUSPECTED: 'var(--warning)', DISMISSED: 'var(--success)' };
  const verdictEmoji = { CONFIRMED_FRAUD: '🔴', SUSPECTED: '🟡', DISMISSED: '🟢' };

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div>
          <h4 style={{ color: 'var(--danger)', marginBottom: 10, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚖️ Evidence for Risk</h4>
          <div className="evidence-list">
            {(evidence || []).map((e, i) => (
              <div key={i} className="evidence-item">
                <span className="evidence-icon">🚨</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 style={{ color: 'var(--success)', marginBottom: 10, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🛡️ Plausible Defense</h4>
          <div className="defense-list">
            {(defense || []).map((d, i) => (
              <div key={i} className="defense-item">
                <span className="defense-icon">✅</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`verdict-banner verdict-${verdict}`}>
        <div className="verdict-label">Final Verdict</div>
        <div className="verdict-text" style={{ color: verdictColor[verdict] }}>
          {verdictEmoji[verdict]} {verdict?.replace(/_/g, ' ')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Confidence:</span>
          <div style={{ flex: 1, maxWidth: 160 }}>
            <div className="confidence-bar">
              <div className={`confidence-fill ${confidence >= 75 ? 'conf-high' : 'conf-medium'}`} style={{ width: `${confidence}%` }} />
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{confidence}%</span>
        </div>
        <div className="verdict-reasoning">{reasoning}</div>
      </div>
    </div>
  );
}

function ExplanationPanel({ text }) {
  if (!text) return null;
  return (
    <div className="explanation-panel fade-in">
      <div className="explanation-icon">🗣️</div>
      <div className="explanation-title">Summary</div>
      <div className="explanation-text">{text}</div>
    </div>
  );
}

function FinancialTimeline({ transactions }) {
  if (!transactions || transactions.length === 0) return null;
  return (
    <div className="timeline-container">
      {transactions.map((t, i) => (
        <div key={t.id} className="timeline-item fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-date">{t.invoice_date}</div>
            <div className="timeline-title">{t.description || 'Invoice'} — {t.invoice_number}</div>
            <div className="timeline-amount">₹{t.amount?.toLocaleString('en-IN')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskGraph({ caseData }) {
  if (!caseData || !caseData.transactions) return null;
  const totalAmount = caseData.transactions.reduce((sum, t) => sum + t.amount, 0);
  
  return (
    <div className="risk-graph-container fade-in">
      <div className="graph-node user" style={{ left: '25%', top: '50%' }}>
        <div className="graph-node-circle">🏢</div>
        <div className="graph-node-label">Your Company</div>
      </div>
      
      <div className="graph-edge" style={{ left: '25%', top: '50%', width: '50%', transform: 'translateY(-50%)' }}>
        <div className="graph-edge-label">{caseData.transactions.length} txns / ₹{totalAmount.toLocaleString('en-IN')}</div>
      </div>
      
      <div className="graph-node vendor" style={{ left: '75%', top: '50%' }}>
        <div className="graph-node-circle">🕴️</div>
        <div className="graph-node-label">{caseData.vendor_name || 'Vendor'}</div>
      </div>
    </div>
  );
}


// ── Financial Crime Storyboard (Feature #9): narrative card sequence ──
function CrimeStoryboard({ caseData, verdict }) {
  const c = caseData;
  const txs = c.transactions || [];
  const total = txs.reduce((s, t) => s + (t.amount || 0), 0);
  const steps = [
    { icon: '🏢', title: 'The Player', text: `${c.vendor_name || 'A vendor'}${c.gstin ? ` (GSTIN ${c.gstin})` : ''} is registered in your books with a ghost-risk score of ${c.ghost_score ?? 0}/100.` },
    { icon: '📥', title: 'The Setup', text: `${txs.length || 'Several'} invoice(s) arrive in a tight window, totalling ₹${total.toLocaleString('en-IN')} — every single one deliberately under the approval limit.` },
    { icon: '✂️', title: 'The Move', text: fraudLabel[c.fraud_type] === 'Delayed Payment'
        ? 'Payment lands far past the statutory 45-day MSME deadline — the supplier is effectively given an interest-free loan at their expense.'
        : fraudLabel[c.fraud_type] === 'Ghost Vendor'
        ? 'Money flows out to an entity whose registration, address and bank details do not withstand verification — a classic shell-vendor payout.'
        : fraudLabel[c.fraud_type] === 'Round-Tripping'
        ? 'Funds leave for one vendor and return via another within days at nearly identical amounts — money laundering in miniature.'
        : 'Each invoice slips below the ₹' + ((txs[0]?.approval_threshold || 100000).toLocaleString('en-IN')) + ' approval threshold, so no senior sign-off is ever triggered.' },
    { icon: '🎭', title: 'The Mask', text: 'On paper each document looks routine — that is exactly why static rule tools miss it. Only the pattern across documents reveals the intent.' },
    ...(verdict ? [{ icon: verdict.verdict === 'INNOCENT' ? '✅' : '⚖️', title: 'The Verdict', text: `${verdict.verdict} (${verdict.confidence}% confidence) — ${verdict.reasoning || verdict.explanation || 'See AI Prosecutor analysis below.'}` }] : [{ icon: '❔', title: 'Unresolved', text: 'Run the AI Prosecutor to close the investigation.' }]),
  ];
  return (
    <div className="card mb-24">
      <div className="card-header"><h3>🎬 Financial Crime Storyboard</h3><span className="badge badge-analyzed">Narrative</span></div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {steps.map((st, i) => (
            <div key={i} className="fade-in-up" style={{ animationDelay: `${i * 0.1}s`, minWidth: 210, maxWidth: 250, background: 'var(--surface-light)', borderRadius: 12, padding: 14, borderLeft: '3px solid var(--primary)' }}>
              <div style={{ fontSize: '1.4rem' }}>{st.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0' }}>Step {i + 1} · {st.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{st.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Remediation Playbook (Gemma-generated) ──
function PlaybookPanel({ caseId }) {
  const [pb, setPb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    try { const res = await casesApi.playbook(caseId); setPb(res.data); }
    catch (e) { setErr(e.response?.data?.details || 'Playbook generation failed'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card mb-24">
      <div className="card-header"><h3>🧰 AI Remediation Playbook</h3>{!pb && <button className="btn btn-secondary btn-sm" onClick={run} disabled={busy}>{busy ? 'Generating…' : 'Generate Playbook'}</button>}</div>
      <div className="card-body">
        {err && <div className="error-banner">{err}</div>}
        {!pb && !busy && <p className="page-subtitle">Gemma drafts step-by-step corrective actions: immediate freezes, investigation steps, regulator filings and policy fixes.</p>}
        {busy && <div><span className="spinner spinner-sm" /> Gemma is writing the playbook…</div>}
        {pb && (
          <div className="grid-2" style={{ gap: 14 }}>
            {[['⚡ Immediate Actions', pb.immediate_actions], ['🔍 Investigation Steps', pb.investigation_steps], ['📋 Regulatory / Filing Duties', pb.regulatory_steps || pb.regulatory_actions || pb.filings], ['🛡️ Policy Fixes', pb.preventive_measures || pb.policy_fixes || pb.long_term]].filter(([, arr]) => Array.isArray(arr) && arr.length).map(([title, arr], i) => (
              <div key={i} style={{ background: 'var(--surface-light)', borderRadius: 10, padding: 14 }}>
                <strong style={{ fontSize: '0.82rem' }}>{title}</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.84rem', lineHeight: 1.6 }}>{arr.map((x, j) => <li key={j}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Evidence Locker (tamper-evident SHA-256 attachments) ──
function EvidenceLocker({ caseId }) {
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState('');
  const load = async () => { try { const r = await casesApi.listEvidence(caseId); setFiles(r.data); } catch {} };
  useEffect(() => { load(); }, [caseId]);
  const onPick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setMsg('❌ File exceeds 5MB limit'); return; }
    const buf = await f.arrayBuffer();
    const b64 = btoa(Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join(''));
    try {
      const r = await casesApi.uploadEvidence(caseId, { filename: f.name, mimeType: f.type, sizeBytes: f.size, contentBase64: b64 });
      setMsg(`✅ Sealed "${f.name}" · SHA-256 ${r.data.sha256.slice(0, 16)}…`);
      load();
    } catch (err) { setMsg('❌ ' + (err.response?.data?.error || 'Upload failed')); }
    e.target.value = '';
  };
  return (
    <div className="card mb-24">
      <div className="card-header"><h3>🔒 Evidence Locker</h3><label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>＋ Seal Document<input type="file" hidden onChange={onPick} /></label></div>
      <div className="card-body">
        {msg && <p style={{ fontSize: '0.8rem', marginBottom: 10 }}>{msg}</p>}
        {files.length === 0 ? <p className="page-subtitle">No evidence sealed yet. Uploaded files are hashed (SHA-256) and recorded in the immutable audit chain — any tampering breaks verification.</p> : (
          <table className="table">
            <thead><tr><th>File</th><th>Size</th><th>SHA-256 (tamper hash)</th><th>By</th><th>When</th></tr></thead>
            <tbody>{files.map(f => (
              <tr key={f.id}><td>{f.filename}</td><td>{(f.size_bytes / 1024).toFixed(1)} KB</td><td className="mono" style={{ fontSize: '0.72rem' }}>{f.sha256.slice(0, 24)}…</td><td>{f.uploaded_by}</td><td>{f.created_at}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Case Workflow history + assignment ──
function WorkflowPanel({ caseId, status }) {
  const [hist, setHist] = useState([]);
  const [assignee, setAssignee] = useState('');
  const load = async () => { try { const r = await casesApi.history(caseId); setHist(r.data); } catch {} };
  useEffect(() => { load(); }, [caseId, status]);
  const assign = async () => {
    if (!assignee.trim()) return;
    try { await casesApi.update(caseId, { assignedTo: assignee.trim() }); setAssignee(''); load(); } catch {}
  };
  return (
    <div className="card mb-24">
      <div className="card-header"><h3>🔄 Case Workflow</h3><span className={`badge badge-${(status || 'open').toLowerCase()}`}>{status}</span></div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Assign case to reviewer email…" value={assignee} onChange={e => setAssignee(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={assign}>Assign</button>
        </div>
        {hist.length === 0 ? <p className="page-subtitle">No transitions recorded yet. Confirm/dismiss or assign to start the workflow trail.</p> : (
          <ol style={{ paddingLeft: 18, fontSize: '0.84rem', lineHeight: 1.8 }}>
            {hist.map(h => <li key={h.id}><strong>{h.from_status || '—'} → {h.to_status}</strong> by {h.user_email || 'system'} <span className="text-muted">({h.created_at})</span>{h.note ? ` — "${h.note}"` : ''}</li>)}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── AI Negotiator — vendor clarification email draft ──
function NegotiatorPanel({ caseId }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState('professional');
  const [copied, setCopied] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const r = await casesApi.negotiate(caseId, tone); setDraft(r.data); } catch {}
    finally { setBusy(false); }
  };
  const copy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.email_body}`);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="card mb-24">
      <div className="card-header">
        <h3>🤝 AI Negotiator</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }} value={tone} onChange={e => setTone(e.target.value)}>
            <option value="professional">Professional</option><option value="firm">Firm</option><option value="friendly">Friendly</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={run} disabled={busy}>{busy ? 'Drafting…' : draft ? '↻ Redraft' : '✉ Draft Clarification Email'}</button>
        </div>
      </div>
      <div className="card-body">
        {!draft && !busy && <p className="page-subtitle">Gemma writes a non-accusatory clarification email to the vendor with targeted questions and a response deadline.</p>}
        {busy && <div><span className="spinner spinner-sm" /> Gemma is drafting the email…</div>}
        {draft && (
          <>
            <div style={{ background: 'var(--surface-light)', borderRadius: 10, padding: 16, whiteSpace: 'pre-wrap', fontSize: '0.86rem', lineHeight: 1.6 }}>
              <strong>Subject: {draft.subject}</strong>
              <div style={{ marginTop: 10 }}>{draft.email_body}</div>
            </div>
            {Array.isArray(draft.key_questions) && (
              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: '0.8rem' }}>Key questions asked:</strong>
                <ul style={{ paddingLeft: 18, fontSize: '0.82rem', marginTop: 6 }}>{draft.key_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={copy}>{copied ? '✅ Copied' : '📋 Copy email'}</button>
          </>
        )}
      </div>
    </div>
  );
}


export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const { smeMode } = React.useContext(ModeContext);

  const loadCase = async () => {
    try {
      const res = await casesApi.get(id);
      setCaseData(res.data);
      if (res.data.verdict) {
        const v = res.data.verdict;
        setVerdict({
          riskReplay: JSON.parse(v.risk_replay || 'null'),
          evidence: JSON.parse(v.evidence || '[]'),
          defense: JSON.parse(v.defense || '[]'),
          verdict: v.verdict,
          confidence: v.confidence,
          reasoning: v.verdict_reasoning,
          explanation: v.explanation,
        });
      }
    } catch {
      setError('Could not load case.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCase(); }, [id]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const res = await casesApi.generateVerdict(id);
      setVerdict({
        riskReplay: res.data.risk_replay,
        evidence: res.data.evidence,
        defense: res.data.defense,
        verdict: res.data.verdict,
        confidence: res.data.confidence,
        reasoning: res.data.verdict_reasoning,
        explanation: res.data.explanation,
      });
      loadCase();
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || 'AI analysis failed. Check AI service.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFeedback = async (status) => {
    try {
      await casesApi.submitFeedback(id, status, feedbackText);
      setFeedbackText('');
      loadCase();
    } catch { setError('Feedback failed.'); }
  };

  if (loading) return <div className="loading-state"><div className="spinner" /><p>Loading case...</p></div>;
  if (!caseData) return <div className="error-banner">Case not found.</div>;

  const c = caseData;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-16" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
          <h1 className="page-title">Case #{c.id} — {c.vendor_name}</h1>
          <p className="page-subtitle">
            <span className={`fraud-tag fraud-${c.fraud_type}`}>{fraudLabel[c.fraud_type]}</span>
            {' '} · Confidence {c.confidence}% · {c.status}
          </p>
        </div>
        <div className="flex gap-12" style={{ alignItems: 'flex-end', flexDirection: 'column', width: '400px' }}>
          {c.status === 'CONFIRMED' || c.status === 'DISMISSED' ? (
             c.feedback_text && (
               <div className="text-muted" style={{ fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'right' }}>
                 " {c.feedback_text} "
               </div>
             )
          ) : (
            <>
              <textarea 
                className="form-input" 
                placeholder="Provide feedback to train the AI model (e.g. 'Legit payment delay due to bank holiday')..."
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div className="flex gap-12">
                <button className="btn btn-danger btn-sm" onClick={() => handleFeedback('DISMISSED')}>✖ Dismiss</button>
                <button className="btn btn-success btn-sm" onClick={() => handleFeedback('CONFIRMED')}>✔ Confirm</button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Case Summary */}
      <div className="card mb-24">
        <div className="card-header">
          <h3>📋 Case Summary</h3>
          <span className={`badge badge-${c.severity?.toLowerCase() === 'critical' ? 'critical' : c.severity?.toLowerCase()}`}>{c.severity}</span>
        </div>
        <div className="card-body">
          <p style={{ marginBottom: 16, lineHeight: 1.7 }}>{c.summary}</p>
          <div className="grid-2">
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>GSTIN</div>
              <div className="mono">{c.gstin || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Ghost Score</div>
              <div style={{ fontWeight: 700, color: c.ghost_score > 70 ? 'var(--danger)' : 'var(--success)' }}>{c.ghost_score}/100</div>
            </div>
          </div>
          {c.transactions?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Flagged Transactions</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Invoice</th><th>Amount</th><th>Date</th><th>Description</th></tr></thead>
                  <tbody>
                    {c.transactions.map(t => (
                      <tr key={t.id} style={{ cursor: 'default' }}>
                        <td className="mono">{t.invoice_number}</td>
                        <td style={{ fontWeight: 600 }}>₹{t.amount?.toLocaleString('en-IN')}</td>
                        <td>{t.invoice_date}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <CrimeStoryboard caseData={c} verdict={verdict} />
      <AutoRemediationPanel fraudType={c.fraud_type} />
      {!smeMode && <PlaybookPanel caseId={id} />}
      {!smeMode && <NegotiatorPanel caseId={id} />}
      {!smeMode && <EvidenceLocker caseId={id} />}
      {!smeMode && <WorkflowPanel caseId={id} status={c.status} />}

      {/* Tier 2 Visualizations */}
      {!smeMode && c.transactions?.length > 0 && (
        <div className="grid-2 mb-24">
          <div className="card">
            <div className="card-header">
              <h3>⏱️ Timeline Investigation</h3>
            </div>
            <div className="card-body">
              <FinancialTimeline transactions={c.transactions} />
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h3>🕸️ Risk Relationship Graph</h3>
            </div>
            <div className="card-body">
              <RiskGraph caseData={c} />
            </div>
          </div>
        </div>
      )}


      {/* AI Analysis Section */}
      {!verdict ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🤖</div>
            <h3 style={{ marginBottom: 8 }}>Run Gemma AI Analysis</h3>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              Gemma will investigate this case using Evidence → Defense → Verdict reasoning
            </p>
            <button
              id={`analyze-btn-${id}`}
              className={`btn btn-primary btn-lg scan-btn ${analyzing ? 'scanning' : ''}`}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing
                ? <><span className="spinner spinner-sm" /> Gemma is analyzing...</>
                : '🔮 Run AI Prosecutor (Gemma)'}
            </button>
            {analyzing && (
              <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                This may take 15–30 seconds while Gemma reasons through the case...
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="stagger">
          {/* Plain Language (Prioritized in SME mode) */}
          {smeMode && verdict.explanation && (
            <div className="card mb-24">
              <div className="card-header">
                <h3>💬 Summary</h3>
              </div>
              <div className="card-body">
                <ExplanationPanel text={verdict.explanation} />
              </div>
            </div>
          )}

          {!smeMode && (
            <div className="card mb-24">
              <div className="card-header">
                <h3>🎯 AI Risk Replay</h3>
                <span className="badge badge-analyzed">Gemma</span>
              </div>
              <div className="card-body">
                <RiskReplayTrail steps={verdict.riskReplay?.steps} />
              </div>
            </div>
          )}

          {!smeMode && (
            <div className="card mb-24">
              <div className="card-header">
                <h3>⚖️ AI Prosecutor — Evidence vs Defense</h3>
                <span className="badge badge-analyzed">Gemma</span>
              </div>
              <div className="card-body">
                <ProsecutorPanel
                  evidence={verdict.evidence}
                  defense={verdict.defense}
                  verdict={verdict.verdict}
                  confidence={verdict.confidence}
                  reasoning={verdict.reasoning}
                />
              </div>
            </div>
          )}

          {!smeMode && (
            <div className="card mb-24">
              <div className="card-header">
                <h3>💬 Summary</h3>
              </div>
              <div className="card-body">
                <ExplanationPanel text={verdict.explanation} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
