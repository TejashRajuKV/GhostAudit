import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ReportPage from './pages/ReportPage';
import ReadinessChecker from './pages/ReadinessChecker';
import TransactionsPage from './pages/TransactionsPage';
import DataEntryPage from './pages/DataEntryPage';
import VendorRiskPage from './pages/VendorRiskPage';
import NetworkPage from './pages/NetworkPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CopilotPage from './pages/CopilotPage';
import IntelLabPage from './pages/IntelLabPage';

export const ModeContext = React.createContext();

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { smeMode, setSmeMode, theme, setTheme } = React.useContext(ModeContext);

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
          <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            💸 Transactions
          </NavLink>
          <NavLink to="/vendors" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            🏢 Vendors & Risk
          </NavLink>
          <NavLink to="/network" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            🕸️ Collusion Network
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            🔬 Analytics Lab
          </NavLink>
          <NavLink to="/copilot" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            💬 Ask Ledger
          </NavLink>
          <NavLink to="/intel" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            🧪 Intel Lab
          </NavLink>
          <NavLink to="/data-entry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            📥 Data Entry
          </NavLink>
          <NavLink to="/readiness" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            📋 Compliance Checker
          </NavLink>
        </nav>

        <div style={{ padding: '0 16px', marginTop: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', background: 'var(--surface-light)', padding: '12px', borderRadius: 8, fontWeight: 600 }}>
            <input type="checkbox" checked={smeMode} onChange={e => setSmeMode(e.target.checked)} />
            SME Simplified
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', background: 'var(--surface-light)', padding: '12px', borderRadius: 8, fontWeight: 600 }}>
            <input type="checkbox" checked={theme === 'light'} onChange={e => {
              const newTheme = e.target.checked ? 'light' : 'dark';
              setTheme(newTheme);
              localStorage.setItem('theme', newTheme);
            }} />
            Light Mode
          </label>
        </div>

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
  const [smeMode, setSmeMode] = React.useState(false);
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'dark');
  
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ModeContext.Provider value={{ smeMode, setSmeMode, theme, setTheme }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <PrivateRoute><Layout><DashboardPage /></Layout></PrivateRoute>
        } />
        <Route path="/cases/:id" element={
          <PrivateRoute><Layout><CaseDetailPage /></Layout></PrivateRoute>
        } />
        <Route path="/transactions" element={
          <PrivateRoute><Layout><TransactionsPage /></Layout></PrivateRoute>
        } />
        <Route path="/vendors" element={
          <PrivateRoute><Layout><VendorRiskPage /></Layout></PrivateRoute>
        } />
        <Route path="/data-entry" element={
          <PrivateRoute><Layout><DataEntryPage /></Layout></PrivateRoute>
        } />
        <Route path="/network" element={
          <PrivateRoute><Layout><NetworkPage /></Layout></PrivateRoute>
        } />
        <Route path="/analytics" element={
          <PrivateRoute><Layout><AnalyticsPage /></Layout></PrivateRoute>
        } />
        <Route path="/copilot" element={
          <PrivateRoute><Layout><CopilotPage /></Layout></PrivateRoute>
        } />
        <Route path="/intel" element={
          <PrivateRoute><Layout><IntelLabPage /></Layout></PrivateRoute>
        } />
        <Route path="/report" element={
          <PrivateRoute><Layout><ReportPage /></Layout></PrivateRoute>
        } />
        <Route path="/readiness" element={
          <PrivateRoute><Layout><ReadinessChecker /></Layout></PrivateRoute>
        } />
      </Routes>
    </ModeContext.Provider>
  );
}
