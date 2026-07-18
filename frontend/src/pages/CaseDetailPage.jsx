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

      <AutoRemediationPanel fraudType={c.fraud_type} />

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
