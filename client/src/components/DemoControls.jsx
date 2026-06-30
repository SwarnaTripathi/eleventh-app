import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function DemoControls() {
  const [open, setOpen] = useState(false);
  const [simulatedNow, setSimulatedNow] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSimulatedTime = async () => {
    try {
      const data = await api.get('/api/dev/simulate-time');
      setSimulatedNow(data.simulatedNow);
    } catch {}
  };

  useEffect(() => { fetchSimulatedTime(); }, []);

  const advance = async (minutes) => {
    setLoading(true);
    try {
      const data = await api.post('/api/dev/simulate-time', { offsetMinutes: minutes });
      setSimulatedNow(data.simulatedNow);
      // Notify Dashboard/TaskDetail to refresh
      window.dispatchEvent(new CustomEvent('eleventh:time-changed'));
    } catch {}
    setLoading(false);
  };

  const reset = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/dev/simulate-time', { reset: true });
      setSimulatedNow(data.simulatedNow);
      window.dispatchEvent(new CustomEvent('eleventh:time-changed'));
    } catch {}
    setLoading(false);
  };

  const seedDemo = async () => {
    setLoading(true);
    try {
      await api.post('/api/dev/seed');
      window.dispatchEvent(new CustomEvent('eleventh:time-changed'));
    } catch {}
    setLoading(false);
  };

  const timeStr = simulatedNow
    ? new Date(simulatedNow).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : '—';

  return (
    <div className="demo-controls">
      <button
        id="demo-controls-toggle"
        className="demo-controls-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span>⚠️ Demo Controls</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="demo-controls-panel fade-in">
          <div className="demo-controls-label">⚠️ Dev tool — not a real product feature</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Advance time</div>
            <div className="demo-time-buttons">
              {[
                { label: '+1h', minutes: 60 },
                { label: '+6h', minutes: 360 },
                { label: '+12h', minutes: 720 },
                { label: '+1d', minutes: 1440 },
                { label: '+2d', minutes: 2880 },
                { label: '+1w', minutes: 10080 },
              ].map(({ label, minutes }) => (
                <button
                  key={label}
                  id={`demo-time-${label.replace('+', 'plus')}`}
                  className="demo-time-btn"
                  onClick={() => advance(minutes)}
                  disabled={loading}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            id="demo-seed-btn"
            className="demo-time-btn"
            onClick={seedDemo}
            disabled={loading}
            style={{ width: '100%', marginBottom: 6, padding: '8px' }}
          >
            🌱 Seed demo tasks
          </button>

          <button
            id="demo-reset-time-btn"
            className="demo-time-btn"
            onClick={reset}
            disabled={loading}
            style={{ width: '100%', marginBottom: 6, padding: '8px' }}
          >
            ↺ Reset time to now
          </button>

          <div className="demo-simulated-time">
            🕐 Simulated: {loading ? '…' : timeStr}
          </div>
        </div>
      )}
    </div>
  );
}
