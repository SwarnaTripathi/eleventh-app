import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import TaskCard from './TaskCard.jsx';
import { useToast } from './Toast.jsx';

// ── Time-of-day greeting ────────────────────────────────────────────────────
function getGreeting(name) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || 'there';
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  if (h < 21) return `Good evening, ${first}`;
  return `Burning the midnight oil, ${first}?`;
}

// ── Live nearest-deadline ticker ────────────────────────────────────────────
function useNearestDeadline(tasks) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nearest = tasks
    .filter(t => t.status === 'active' || !t.status)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

  if (!nearest) return null;

  const ms = new Date(nearest.deadline).getTime() - now;
  const mins = ms / 60000;
  if (mins <= 0) return { text: 'Overdue!', state: 'critical', title: nearest.title };
  if (mins < 60) return { text: `${Math.floor(mins)}m`, state: mins < 30 ? 'critical' : 'attention', title: nearest.title };
  if (mins < 24 * 60) {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    const state = h < 2 ? 'critical' : h < 6 ? 'attention' : 'calm';
    return { text: `${h}h ${m}m`, state, title: nearest.title };
  }
  const d = Math.floor(mins / (24 * 60));
  return { text: `${d}d`, state: 'calm', title: nearest.title };
}

// ── Filter buttons config ───────────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'All', cls: '' },
  { key: 'calm', label: 'Calm', cls: 'filter-calm' },
  { key: 'attention', label: 'Attention', cls: 'filter-attention' },
  { key: 'critical', label: 'Critical', cls: 'filter-critical' },
  { key: 'infeasible', label: 'Infeasible', cls: 'filter-negotiate' },
];

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.get('/api/tasks');
      setTasks(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  // Listen for time simulation events from DemoControls
  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener('eleventh:time-changed', handler);
    return () => window.removeEventListener('eleventh:time-changed', handler);
  }, [loadTasks]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await api.post('/api/dev/seed');
      await loadTasks();
      toast.success('Demo data loaded successfully!');
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load demo data');
    } finally {
      setSeeding(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const urgencyOrder = { critical: 0, attention: 1, calm: 2 };
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    const ua = !a.feasible ? -1 : (urgencyOrder[a.urgencyState] ?? 3);
    const ub = !b.feasible ? -1 : (urgencyOrder[b.urgencyState] ?? 3);
    return ua - ub || new Date(a.deadline) - new Date(b.deadline);
  }), [tasks]);

  const filtered = useMemo(() => {
    let result = sorted;
    if (filter === 'calm') result = result.filter(t => t.urgencyState === 'calm' && t.feasible !== false);
    else if (filter === 'attention') result = result.filter(t => t.urgencyState === 'attention' && t.feasible !== false);
    else if (filter === 'critical') result = result.filter(t => t.urgencyState === 'critical' && t.feasible !== false);
    else if (filter === 'infeasible') result = result.filter(t => !t.feasible);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [sorted, filter, search]);

  const counts = useMemo(() => ({
    all: tasks.length,
    calm: tasks.filter(t => t.urgencyState === 'calm' && t.feasible !== false).length,
    attention: tasks.filter(t => t.urgencyState === 'attention' && t.feasible !== false).length,
    critical: tasks.filter(t => t.urgencyState === 'critical' && t.feasible !== false).length,
    infeasible: tasks.filter(t => !t.feasible).length,
  }), [tasks]);

  const doneToday = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.reduce((count, t) => {
      const doneSubs = t.subtasks?.filter(s => s.status === 'done').length || 0;
      return count + doneSubs;
    }, 0);
  }, [tasks]);

  const totalProgress = useMemo(() => {
    const totalSubs = tasks.reduce((s, t) => s + (t.subtasks?.length || 0), 0);
    const doneSubs = tasks.reduce((s, t) => s + (t.subtasks?.filter(sub => sub.status === 'done').length || 0), 0);
    return totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  }, [tasks]);

  const nearest = useNearestDeadline(tasks);

  return (
    <div>
      {/* Greeting */}
      <div className="dashboard-greeting">
        <h1 className="greeting-text">{loading ? 'Loading…' : getGreeting(user?.name)}</h1>
        <p className="greeting-subtitle">
          {tasks.length === 0 ? (
            'Add your first task to get started'
          ) : (
            <>
              {tasks.length} active task{tasks.length !== 1 ? 's' : ''}
              {nearest && (
                <>
                  {' · '}
                  <span className={`nearest-deadline-ticker ${nearest.state}`}>
                    ⏱ {nearest.text} until "{nearest.title?.slice(0, 30)}{nearest.title?.length > 30 ? '…' : ''}"
                  </span>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {/* Stats Ribbon */}
      {!loading && tasks.length > 0 && (
        <div className="stats-ribbon fade-in">
          <div className="stat-card stat-card--accent">
            <div className="stat-card-icon">📋</div>
            <div className="stat-card-value">{tasks.length}</div>
            <div className="stat-card-label">Active Tasks</div>
          </div>
          <div className="stat-card stat-card--calm">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-value">{doneToday}</div>
            <div className="stat-card-label">Subtasks Done</div>
          </div>
          <div className="stat-card stat-card--critical">
            <div className="stat-card-icon">🔥</div>
            <div className="stat-card-value">{counts.critical}</div>
            <div className="stat-card-label">Critical</div>
          </div>
          <div className="stat-card stat-card--attention">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-value">{totalProgress}%</div>
            <div className="stat-card-label">Overall Progress</div>
          </div>
        </div>
      )}

      {/* Dashboard Header: Filter + Search + Actions */}
      <div className="dashboard-header">
        {tasks.length > 0 && (
          <div className="filter-bar">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-btn ${f.cls} ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {counts[f.key] > 0 && (
                  <span className="filter-count">{counts[f.key]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="dashboard-controls">
          {tasks.length > 0 && (
            <div className="search-bar-wrapper">
              <span className="search-bar-icon">🔍</span>
              <input
                id="search-tasks"
                className="search-bar"
                type="text"
                placeholder="Search tasks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="search-bar-shortcut">/</span>
            </div>
          )}

          {tasks.length === 0 && (
            <button
              id="seed-demo-btn"
              className="btn btn-ghost btn-sm"
              onClick={handleSeedDemo}
              disabled={seeding}
            >
              {seeding ? '⏳ Seeding…' : '🌱 Load Demo Data'}
            </button>
          )}
          <button
            id="add-task-btn"
            className="btn btn-primary"
            onClick={() => navigate('/tasks/new')}
          >
            + New Task
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {loading ? (
        <div className="tasks-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card task-card" style={{ height: 200 }}>
              <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 20 }} />
              <div className="skeleton" style={{ height: 4, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state fade-in">
          <div className="empty-state-icon">🚀</div>
          <h2 className="empty-state-title">Ready to ship?</h2>
          <p className="empty-state-text">
            Add a task with a deadline and let Eleventh plan your path to it.<br />
            The AI will break it into subtasks, schedule them, and keep you on track.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/tasks/new')}>
              + Add your first task
            </button>
            <button className="btn btn-ghost" onClick={handleSeedDemo} disabled={seeding}>
              {seeding ? '⏳ Loading…' : '🌱 Try with demo data'}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state fade-in" style={{ padding: '40px 24px' }}>
          <div className="empty-state-icon" style={{ fontSize: '2.5rem' }}>🔍</div>
          <h2 className="empty-state-title" style={{ fontSize: '1.1rem' }}>No tasks match</h2>
          <p className="empty-state-text" style={{ fontSize: '0.85rem' }}>
            Try a different filter or search term.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilter('all'); setSearch(''); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="tasks-grid">
          {filtered.map((task, i) => (
            <div key={task.id} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <TaskCard
                task={task}
                onClick={() => navigate(`/tasks/${task.id}`)}
                onRefresh={loadTasks}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
