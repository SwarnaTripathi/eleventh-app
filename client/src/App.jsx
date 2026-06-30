import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AuthGate from './components/AuthGate.jsx';
import Dashboard from './components/Dashboard.jsx';
import AddTaskForm from './components/AddTaskForm.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import DemoControls from './components/DemoControls.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { api } from './api.js';

// ── Keyboard Shortcuts Modal ────────────────────────────────────────────────
function ShortcutsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const shortcuts = [
    { key: 'N', label: 'New task' },
    { key: 'Esc', label: 'Back to dashboard' },
    { key: '/', label: 'Focus search' },
    { key: 'Space', label: 'Complete next subtask (in task detail)' },
    { key: '?', label: 'Show keyboard shortcuts' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">⌨️ Keyboard Shortcuts</h2>
        <div className="shortcuts-grid">
          {shortcuts.map(s => (
            <div key={s.key} className="shortcut-item">
              <span className="shortcut-label">{s.label}</span>
              <span className="shortcut-key">{s.key}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Keyboard Shortcut Handler ───────────────────────────────────────────────
function KeyboardHandler({ setShowShortcuts }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e) => {
      // Don't trigger in input/textarea fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      // Don't trigger with modifier keys (except shift for ?)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault();
          navigate('/tasks/new');
          break;
        case 'Escape':
          if (location.pathname !== '/') {
            e.preventDefault();
            navigate('/');
          }
          break;
        case '/':
          e.preventDefault();
          document.getElementById('search-tasks')?.focus();
          break;
        case '?':
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location, setShowShortcuts]);

  return null;
}

// ── App Shell (inside Router) ───────────────────────────────────────────────
function AppShell({ user, setUser, demoMode }) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="app-shell">
      <KeyboardHandler setShowShortcuts={setShowShortcuts} />

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <a href="/" className="navbar-logo">
            <div className="logo-badge">11</div>
            <span>Eleventh</span>
          </a>
          <div className="navbar-actions">
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts (?)"
              style={{ fontSize: '0.85rem' }}
            >
              ⌨️
            </button>
            <div className="user-pill">
              <div className="user-avatar">
                {user.picture
                  ? <img src={user.picture} alt={user.name} />
                  : (user.name?.[0] || 'U').toUpperCase()
                }
              </div>
              <span>{user.name || user.email}</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                api.post('/auth/logout').finally(() => {
                  setUser(null);
                  window.location.href = '/';
                });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Routes */}
      <main style={{ flex: 1 }}>
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/tasks/new" element={<AddTaskForm user={user} />} />
            <Route path="/tasks/:id" element={<TaskDetail user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Demo Controls — only visible in DEMO_MODE */}
      {demoMode && <DemoControls />}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Check app config
    api.get('/api/config')
      .then(cfg => setDemoMode(cfg.demoMode))
      .catch(() => {});

    // Check auth status
    api.get('/auth/me')
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" />
        <p>Loading Eleventh…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <AuthGate demoMode={demoMode} onLogin={setUser} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell user={user} setUser={setUser} demoMode={demoMode} />
      </BrowserRouter>
    </ToastProvider>
  );
}
