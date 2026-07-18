import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../apiClient';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@ghostaudit.ai');
  const [password, setPassword] = useState('ghostaudit123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card fade-in-up">
        <div className="login-logo">
          <h1>👻 GhostAudit</h1>
          <p>AI Fraud Pattern & Compliance Risk Triage Copilot</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Authenticating...</> : '🔐 Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Demo: admin@ghostaudit.ai / ghostaudit123
        </p>
      </div>
    </div>
  );
}
