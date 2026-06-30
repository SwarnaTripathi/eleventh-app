import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function SubtaskPreview({ subtasks, loading }) {
  if (loading) {
    return (
      <div className="subtask-preview">
        <div className="subtask-preview-header">
          <span className="subtask-preview-title">✨ AI Planning…</span>
        </div>
        <div className="subtask-preview-list">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="subtask-preview-item">
              <div className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%' }} />
              <div className="skeleton" style={{ flex: 1, height: 14 }} />
              <div className="skeleton" style={{ width: 40, height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!subtasks || subtasks.length === 0) return null;

  const totalMinutes = subtasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className="subtask-preview fade-in">
      <div className="subtask-preview-header">
        <span className="subtask-preview-title">✨ AI-Generated Plan</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ~{h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''} total
        </span>
      </div>
      <div className="subtask-preview-list">
        {subtasks.map((s, i) => (
          <div key={i} className="subtask-preview-item">
            <div className="subtask-preview-dot" />
            <span className="subtask-preview-name">{s.title}</span>
            <span className="subtask-preview-time">{s.estimatedMinutes}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AddTaskForm({ user }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [previewSubtasks, setPreviewSubtasks] = useState(null);
  const [error, setError] = useState('');
  const [taskCreated, setTaskCreated] = useState(null);

  // Min deadline = 15 minutes from now
  const minDeadline = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !deadline) return;

    setLoading(true);
    setPlanning(true);
    setError('');
    setPreviewSubtasks(null);

    try {
      const task = await api.post('/api/tasks', {
        title: title.trim(),
        description: description.trim(),
        deadline: new Date(deadline).toISOString(),
      });

      setTaskCreated(task);

      // Poll for subtasks (planner runs async server-side)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const detail = await api.get(`/api/tasks/${task.id}`);
          if (detail.subtasks && detail.subtasks.length > 0) {
            setPreviewSubtasks(detail.subtasks);
            setPlanning(false);
            clearInterval(poll);
          }
          if (attempts >= 12) { // 12 * 2.5s = 30s timeout
            setPlanning(false);
            clearInterval(poll);
          }
        } catch { clearInterval(poll); setPlanning(false); }
      }, 2500);

    } catch (err) {
      setError(err.message);
      setLoading(false);
      setPlanning(false);
    }
  };

  const handleGoToDashboard = () => navigate('/');
  const handleViewTask = () => navigate(`/tasks/${taskCreated.id}`);

  if (taskCreated && !planning && previewSubtasks) {
    return (
      <div className="add-task-page">
        <div className="card add-task-card slide-up">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎯</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Plan created!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Eleventh has broken your task into {previewSubtasks.length} subtasks and scheduled them in your calendar.
            </p>
          </div>

          <SubtaskPreview subtasks={previewSubtasks} loading={false} />

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleViewTask}>View task →</button>
            <button className="btn btn-ghost" onClick={handleGoToDashboard}>Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-task-page">
      <button className="page-back-btn" onClick={() => navigate('/')}>
        ← Back to dashboard
      </button>

      <h1 className="page-title">Add a new task</h1>
      <p className="page-subtitle">
        Tell Eleventh what needs to be done and when — it'll do the rest.
      </p>

      <div className="card add-task-card">
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">What needs to be done?</label>
            <input
              id="task-title"
              className="form-input"
              type="text"
              placeholder="e.g. Finish my assignment report"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={500}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-description">Description (optional)</label>
            <textarea
              id="task-description"
              className="form-textarea"
              placeholder="Any additional context about the task…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-deadline">Deadline</label>
            <input
              id="task-deadline"
              className="form-input"
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={minDeadline}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {planning && (
            <SubtaskPreview subtasks={null} loading={true} />
          )}

          {!taskCreated && (
            <button
              id="create-task-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !title.trim() || !deadline}
              style={{ width: '100%' }}
            >
              {loading ? '⏳ Creating plan…' : '✨ Create task + generate plan'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
