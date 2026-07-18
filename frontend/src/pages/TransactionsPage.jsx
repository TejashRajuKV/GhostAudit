import React, { useState, useEffect } from 'react';
import { transactionsApi } from '../apiClient';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await transactionsApi.getAll();
        setTransactions(res.data);
      } catch (err) {
        setError('Failed to load transactions.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  if (loading) return <div className="loading-state"><div className="spinner" /><p>Loading transactions...</p></div>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="fade-in stagger">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions Ledger</h1>
          <p className="page-subtitle">View all transactions across all vendors.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h3>All Transactions ({transactions.length})</h3>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} onClick={() => setSelectedTx(t)} style={{ cursor: 'pointer' }} className="hoverable-row">
                    <td>
                      {t.vendor_name}
                      {t.is_ghost === 1 && <span className="badge badge-critical" style={{ marginLeft: 8 }}>GHOST</span>}
                    </td>
                    <td className="mono">{t.invoice_number}</td>
                    <td>{t.invoice_date}</td>
                    <td style={{ fontWeight: 700 }}>₹{t.amount.toLocaleString('en-IN')}</td>
                    <td>
                      {t.is_flagged === 1 ? (
                        <span className="badge badge-high">FLAGGED</span>
                      ) : (
                        <span className="badge badge-low">CLEAN</span>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTx && (
        <div className="modal-backdrop" onClick={() => setSelectedTx(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Transaction Details</h2>
              <button className="btn-close" onClick={() => setSelectedTx(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Vendor</span>
                  <div style={{ fontWeight: 600 }}>{selectedTx.vendor_name}</div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Invoice Number</span>
                  <div className="mono">{selectedTx.invoice_number}</div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Amount</span>
                  <div style={{ fontWeight: 600 }}>₹{selectedTx.amount.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Status</span>
                  <div>
                    {selectedTx.is_flagged === 1 ? <span className="badge badge-high">FLAGGED</span> : <span className="badge badge-low">CLEAN</span>}
                  </div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Invoice Date</span>
                  <div>{selectedTx.invoice_date}</div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Payment Date</span>
                  <div>{selectedTx.payment_date || 'N/A'}</div>
                </div>
              </div>
              {selectedTx.description && (
                <div>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Description</span>
                  <p style={{ background: 'var(--surface-light)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {selectedTx.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
