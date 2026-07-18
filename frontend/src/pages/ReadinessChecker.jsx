import React, { useState } from 'react';

const questions = [
  { id: 'q1', text: 'Does your business have a valid GSTIN registered?', category: 'MSME' },
  { id: 'q2', text: 'Are you registered on the Udyam portal as an MSME?', category: 'MSME' },
  { id: 'q3', text: 'Do you file GST returns (GSTR-1, GSTR-3B) on time every month?', category: 'MSME' },
  { id: 'q4', text: 'Do you collect explicit consent before collecting personal customer data?', category: 'DPDP' },
  { id: 'q5', text: 'Do you have a clear Privacy Policy available on your website?', category: 'DPDP' },
  { id: 'q6', text: 'Is customer data stored securely with access restricted to authorized employees?', category: 'DPDP' },
  { id: 'q7', text: 'Do you have a process to delete customer data if requested (Right to Erasure)?', category: 'DPDP' }
];

export default function ReadinessChecker() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (id, value) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const calculateScore = () => {
    const total = questions.length;
    const yesCount = Object.values(answers).filter(v => v === 'yes').length;
    return Math.round((yesCount / total) * 100);
  };

  const score = calculateScore();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Readiness Checker</h1>
          <p className="page-subtitle">Assess your MSME formalization and DPDP Data Privacy readiness.</p>
        </div>
      </div>

      <div className="card mb-24" style={{ maxWidth: 800 }}>
        <div className="card-header">
          <h3>📋 Assessment Checklist</h3>
        </div>
        <div className="card-body">
          {!submitted ? (
            <div>
              {questions.map((q, idx) => (
                <div key={q.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    <span className={`badge ${q.category === 'MSME' ? 'badge-medium' : 'badge-high'}`} style={{ marginRight: 8 }}>
                      {q.category}
                    </span>
                    {idx + 1}. {q.text}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={q.id} 
                        checked={answers[q.id] === 'yes'} 
                        onChange={() => handleSelect(q.id, 'yes')} 
                      />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={q.id} 
                        checked={answers[q.id] === 'no'} 
                        onChange={() => handleSelect(q.id, 'no')} 
                      />
                      No
                    </label>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 24 }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setSubmitted(true)}
                  disabled={Object.keys(answers).length < questions.length}
                >
                  Generate Readiness Score
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }} className="fade-in-up">
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>
                {score >= 80 ? '🏆' : score >= 50 ? '⚠️' : '🚨'}
              </div>
              <h2 style={{ fontSize: '2rem', marginBottom: 8, color: score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                {score}% Ready
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto' }}>
                {score >= 80 
                  ? 'Great job! You are well-positioned for regulatory audits and data privacy laws.' 
                  : score >= 50 
                    ? 'You have a foundational setup, but there are critical gaps you need to address soon to avoid penalties.' 
                    : 'High Risk. Your business is operating informally and is highly exposed to DPDP and MSME compliance violations.'}
              </p>
              <button className="btn btn-ghost" onClick={() => { setSubmitted(false); setAnswers({}); }}>
                Retake Assessment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
