import React, { useState, useEffect, useRef } from 'react';
import { reportsApi } from '../apiClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ReportPage() {
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const reportRef = useRef(null);

  const loadReports = async () => {
    try {
      const res = await reportsApi.list();
      setReports(res.data);
      if (res.data.length > 0) setActiveReport(res.data[0]);
    } catch { setError('Failed to load reports.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReports(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await reportsApi.generate();
      setActiveReport(res.data);
      loadReports();
    } catch (err) {
      setError(err.response?.data?.error || 'Report generation failed. Analyze cases first.');
    } finally { setGenerating(false); }
  };

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: '#080c18', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`GhostAudit_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch { setError('Export failed.'); }
    finally { setExporting(false); }
  };

  const parseJson = (str) => { try { return JSON.parse(str || '[]'); } catch { return []; } };

  const riskColor = { CRITICAL: 'var(--danger)', HIGH: 'var(--warning)', MEDIUM: 'var(--info)', LOW: 'var(--success)' };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Report</h1>
          <p className="page-subtitle">Gemma-generated formal compliance report</p>
        </div>
        <div className="flex gap-12">
          <button
            id="generate-report-btn"
            className={`btn btn-primary scan-btn ${generating ? 'scanning' : ''}`}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <><span className="spinner spinner-sm" /> Generating...</> : '📊 Generate Report'}
          </button>
          {activeReport && (
            <button
              id="export-pdf-btn"
              className="btn btn-success"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <><span className="spinner spinner-sm" /> Exporting...</> : '⬇️ Export PDF'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state"><div className="spinner" /><p>Loading reports...</p></div>
      ) : !activeReport ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Reports Yet</h3>
            <p className="text-muted">First analyze cases via "Run AI Prosecutor", then generate a report.</p>
            <button className="btn btn-primary mt-16" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : '📊 Generate First Report'}
            </button>
          </div>
        </div>
      ) : (
        <div ref={reportRef} className="card fade-in-up">
          <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.1), rgba(0,212,170,0.05))' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Audit Report</div>
              <h2 style={{ fontSize: '1.1rem' }}>{activeReport.title}</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Generated: {new Date(activeReport.created_at).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Overall Risk</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: riskColor[activeReport.risk_rating] || 'var(--warning)' }}>
                {activeReport.risk_rating}
              </div>
            </div>
          </div>

          <div className="card-body">
            {/* Executive Summary */}
            <div className="report-section">
              <h3>Executive Summary</h3>
              <p style={{ lineHeight: 1.75, color: 'var(--text-primary)' }}>{activeReport.executive_summary}</p>
            </div>

            <div className="divider" />

            {/* Findings */}
            <div className="report-section">
              <h3>Findings</h3>
              {parseJson(activeReport.findings).map((f, i) => (
                <div key={i} style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-12 mb-16">
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>FINDING {f.case_number}</span>
                    <span className={`badge badge-${f.risk_level?.toLowerCase() === 'critical' ? 'critical' : f.risk_level?.toLowerCase()}`}>{f.risk_level}</span>
                    <span className={`fraud-tag fraud-${f.fraud_type}`}>{f.fraud_type?.replace(/_/g, ' ')}</span>
                  </div>
                  <h4 style={{ marginBottom: 8 }}>{f.vendor}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.narrative}</p>
                  <div style={{ marginTop: 8, display: 'inline-block', padding: '3px 10px', background: 'var(--verdict-bg)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
                    Verdict: {f.verdict}
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            {/* Recommendations */}
            <div className="report-section">
              <h3>Recommended Actions</h3>
              {parseJson(activeReport.recommendations).map((r, i) => (
                <div key={i} className="recommendation-item">
                  <div className="rec-num">{i + 1}</div>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
