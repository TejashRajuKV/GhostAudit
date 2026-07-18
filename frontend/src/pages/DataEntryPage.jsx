import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { transactionsApi, vendorsApi } from '../apiClient';

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState('manual');
  const [vendors, setVendors] = useState([]);
  
  const generateInvoiceNumber = () => `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Manual Entry State
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [description, setDescription] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualError, setManualError] = useState('');

  // Bulk Upload State
  const [fileData, setFileData] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkError, setBulkError] = useState('');

  useEffect(() => {
    vendorsApi.getAll().then(res => setVendors(res.data)).catch(console.error);
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualLoading(true);
    setManualSuccess('');
    setManualError('');
    
    if (paymentDate && new Date(paymentDate) < new Date(invoiceDate)) {
      setManualError('Payment date cannot be earlier than invoice date.');
      setManualLoading(false);
      return;
    }

    try {
      await transactionsApi.create({
        vendor_id: parseInt(vendorId),
        amount: parseFloat(amount),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        payment_date: paymentDate || null,
        description
      });
      setManualSuccess('Transaction added successfully!');
      setVendorId(''); setAmount(''); setInvoiceNumber(generateInvoiceNumber()); setInvoiceDate(''); setPaymentDate(''); setDescription('');
    } catch (err) {
      setManualError('Failed to add transaction.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkError('');
    setBulkSuccess('');
    setFileData([]);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setFileData(results.data);
        },
        error: () => setBulkError('Failed to parse CSV file.')
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setFileData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      setBulkError('Unsupported file type. Please upload CSV or Excel.');
    }
  };

  const handleBulkSubmit = async () => {
    if (fileData.length === 0) return;
    setBulkLoading(true);
    setBulkSuccess('');
    setBulkError('');

    try {
      // Map JSON fields to expected schema
      const payload = {
        transactions: fileData.map(row => ({
          vendor_id: parseInt(row.vendor_id || row.VendorID),
          amount: parseFloat(row.amount || row.Amount),
          invoice_number: row.invoice_number || row.InvoiceNumber,
          invoice_date: row.invoice_date || row.InvoiceDate,
          payment_date: row.payment_date || row.PaymentDate || null,
          description: row.description || row.Description || ''
        }))
      };
      
      const res = await transactionsApi.bulkCreate(payload);
      setBulkSuccess(`Successfully inserted ${res.data.count} transactions!`);
      setFileData([]);
    } catch (err) {
      setBulkError('Failed to bulk insert transactions.');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="fade-in stagger">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Entry</h1>
          <p className="page-subtitle">Inject transactions manually or via bulk upload.</p>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header" style={{ padding: '0', display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button 
            style={{ flex: 1, padding: '16px', background: activeTab === 'manual' ? 'var(--bg-card-hover)' : 'transparent', border: 'none', color: activeTab === 'manual' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setActiveTab('manual')}
          >
            ✍️ Manual Entry
          </button>
          <button 
            style={{ flex: 1, padding: '16px', background: activeTab === 'bulk' ? 'var(--bg-card-hover)' : 'transparent', border: 'none', color: activeTab === 'bulk' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setActiveTab('bulk')}
          >
            📁 Bulk Upload
          </button>
        </div>

        <div className="card-body">
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
              {manualSuccess && <div className="badge badge-low">{manualSuccess}</div>}
              {manualError && <div className="badge badge-critical">{manualError}</div>}
              
              <div>
                <label className="form-label">Vendor</label>
                <select className="form-input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
                  <option value="">Select a vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (ID: {v.id})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="form-label">Amount (₹)</label>
                <input type="number" step="0.01" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Invoice Date</label>
                  <input type="date" className="form-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Payment Date</label>
                  <input type="date" className="form-input" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" disabled={manualLoading}>
                {manualLoading ? 'Saving...' : 'Save Transaction'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {bulkSuccess && <div className="badge badge-low">{bulkSuccess}</div>}
              {bulkError && <div className="badge badge-critical">{bulkError}</div>}
              
              <div>
                <label className="form-label">Upload CSV or Excel</label>
                <input type="file" className="form-input" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                  Required Columns: vendor_id, amount, invoice_number, invoice_date. Optional: payment_date, description.
                </p>
              </div>

              {fileData.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '10px' }}>Preview ({fileData.length} rows)</h4>
                  <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor ID</th>
                          <th>Invoice No</th>
                          <th>Amount</th>
                          <th>Invoice Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td>{row.vendor_id || row.VendorID}</td>
                            <td className="mono">{row.invoice_number || row.InvoiceNumber}</td>
                            <td>{row.amount || row.Amount}</td>
                            <td>{row.invoice_date || row.InvoiceDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {fileData.length > 10 && <p className="text-muted" style={{ marginTop: '10px' }}>Showing first 10 rows...</p>}
                  
                  <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={handleBulkSubmit} disabled={bulkLoading}>
                    {bulkLoading ? 'Uploading...' : `Submit ${fileData.length} Transactions`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
