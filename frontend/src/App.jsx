import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ReportPage from './pages/ReportPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">👻 GhostAudit</div>
          <div className="logo-sub">AI Compliance Copilot</div>
        </div>

        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            🎯 Dashboard
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            📊 Audit Report
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            {user?.email}
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <PrivateRoute><Layout><DashboardPage /></Layout></PrivateRoute>
      } />
      <Route path="/cases/:id" element={
        <PrivateRoute><Layout><CaseDetailPage /></Layout></PrivateRoute>
      } />
      <Route path="/report" element={
        <PrivateRoute><Layout><ReportPage /></Layout></PrivateRoute>
      } />
    </Routes>
  );
}
