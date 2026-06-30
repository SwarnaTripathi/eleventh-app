import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import NegotiatePanel from './NegotiatePanel.jsx';
import Confetti from './Confetti.jsx';
import { useToast } from './Toast.jsx';

// ── Action Panel ────────────────────────────────────────────────────────────
function ActionPanel({ task, onRefresh }) {
  const toast = useToast();
  const emailDraft = task.actionDrafts?.find(d => d.type === 'email' && d.status === 'proposed');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');

  if (dismissed || !emailDraft) return null;

  const content = typeof emailDraft.content === 'object'
    ? emailDraft.content
    : (() => { try { return JSON.parse(emailDraft.content || '{}'); } catch { return {}; } })();

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      await api.post(`/api/tasks/${task.id}/action/send`, { to: emailRecipient });
      setSent(true);
      toast.success('Email sent via Gmail');
      onRefresh?.();
    } catch (err) {
      setError(err.message);
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleDismiss = async () => {
    try { await api.post(`/api/tasks/${task.id}/action/dismiss`); } catch {}
    setDismissed(true);
  };

  return (
    <div className="action-panel fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span className="urgency-badge badge-critical">Critical — Action Required</span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            Eleventh has drafted an email for you
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Review it below. Sending requires your explicit confirmation.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>Dismiss</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      <div className="email-preview">
        <div className="email-preview-subject">Subject: {content.subject}</div>
        <div className="email-preview-body">{content.body}</div>
      </div>

      {!sent ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <input
            type="email"
            className="form-input"
            placeholder="Recipient email (optional)"
            value={emailRecipient}
            onChange={e => setEmailRecipient(e.target.value)}
            style={{ flex: '1 1 200px', padding: '8px 12px', fontSize: '0.85rem' }}
          />
          <button
            id={`send-action-email-${task.id}`}
            className="btn btn-danger btn-sm"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? '⏳ Sending…' : '✉️ Send email'}
          </button>
        </div>
      ) : (
        <div className="alert alert-success" style={{ marginTop: 12 }}>✓ Email sent via Gmail</div>
      )}
    </div>
  );
}

// ── Timeline Subtask Item ───────────────────────────────────────────────────
function TimelineSubtask({ subtask, taskId, onRefresh, isFirst }) {
  const toast = useToast();
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);

  const isDone = subtask.status === 'done';
  const isNext = isFirst && !isDone;

  const toggle = async () => {
    setUpdating(true);
    try {
      const newStatus = isDone ? 'scheduled' : 'done';
      await api.patch(`/api/tasks/${taskId}/subtasks/${subtask.id}`, { status: newStatus });
      toast.success(isDone ? 'Subtask reopened' : 'Subtask completed!');
      onRefresh?.();
    } catch {}
    setUpdating(false);
  };

  const handleEditSave = () => {
    // In demo mode we can't save title changes server-side, just update locally
    setEditing(false);
  };

  return (
    <div className="timeline-item fade-in">
      <div className={`timeline-dot ${isDone ? 'done' : ''} ${isNext ? 'active' : ''}`}>
        {isDone && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      <div className={`timeline-content ${isDone ? 'done' : ''}`} onClick={toggle}>
        <button
          className={`subtask-checkbox ${isDone ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          disabled={updating}
          aria-label={isDone ? 'Mark as pending' : 'Mark as done'}
        >
          {isDone && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              className="inline-edit-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={e => e.key === 'Enter' && handleEditSave()}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className="timeline-title"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
              title="Double-click to edit"
            >
              {subtask.title}
            </span>
          )}
          {subtask.scheduledStart && (
            <div className="timeline-schedule">
              📅 {new Date(subtask.scheduledStart).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {subtask.cuttable && (
            <span style={{ fontSize: '0.7rem', color: 'var(--negotiate)', background: 'var(--negotiate-dim)',
              padding: '2px 6px', borderRadius: 99, fontWeight: 600 }}>Cuttable</span>
          )}
          <span className="timeline-time">{subtask.estimatedMinutes}m</span>
        </div>
      </div>
    </div>
  );
}

// ── Hero Progress Section ───────────────────────────────────────────────────
function HeroProgress({ task }) {
  const doneCount = task.subtasks?.filter(s => s.status === 'done').length || 0;
  const totalCount = task.subtasks?.length || 0;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const state = task.urgencyState || 'calm';

  const size = 80;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const stateColors = { calm: 'var(--calm)', attention: 'var(--attention)', critical: 'var(--critical)' };
  const color = !task.feasible ? 'var(--negotiate)' : (stateColors[state] || 'var(--calm)');

  return (
    <div className="task-detail-hero fade-in">
      <div className="hero-progress-ring">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="4"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <span className="hero-progress-text" style={{ color }}>{pct}%</span>
      </div>

      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hero-stat-value">{doneCount}/{totalCount}</div>
          <div className="hero-stat-label">Subtasks</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value" style={{ color }}>{Math.round(task.workLeft || 0)}m</div>
          <div className="hero-stat-label">Work Left</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value" style={{ color }}>
            {task.bufferRatio === Infinity ? '∞' : (task.bufferRatio?.toFixed(1) || '—')}x
          </div>
          <div className="hero-stat-label">Buffer</div>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation Modal ──────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Log ────────────────────────────────────────────────────────────
function ActivityLog({ task }) {
  const activities = [];

  if (task.createdAt) {
    activities.push({ text: 'Task created', time: task.createdAt });
  }

  const doneSubs = task.subtasks?.filter(s => s.status === 'done') || [];
  doneSubs.forEach(s => {
    activities.push({ text: `Completed: ${s.title}`, time: s.updatedAt || task.createdAt });
  });

  if (task.urgencyState === 'critical') {
    activities.push({ text: 'Escalated to Critical', time: new Date().toISOString() });
  }

  if (!task.feasible) {
    activities.push({ text: 'Feasibility alert triggered', time: new Date().toISOString() });
  }

  // Show at most 5 recent
  const recent = activities.slice(-5).reverse();

  if (recent.length === 0) return null;

  return (
    <div>
      <div className="section-title">Activity</div>
      <div className="activity-log">
        {recent.map((a, i) => (
          <div key={i} className="activity-item fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="activity-dot" />
            <span>{a.text}</span>
            <span className="activity-time">
              {new Date(a.time).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main TaskDetail Component ───────────────────────────────────────────────
export default function TaskDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTask = useCallback(async () => {
    try {
      const data = await api.get(`/api/tasks/${id}`);
      setTask(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTask();
    const interval = setInterval(loadTask, 30000);
    return () => clearInterval(interval);
  }, [loadTask]);

  // Keyboard shortcut: Space to toggle first undone subtask
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && task?.subtasks) {
        e.preventDefault();
        const next = task.subtasks.find(s => s.status !== 'done');
        if (next) {
          api.patch(`/api/tasks/${id}/subtasks/${next.id}`, { status: 'done' })
            .then(() => { toast.success('Subtask completed!'); loadTask(); })
            .catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [task, id, loadTask, toast]);

  const handleCompleteTask = async () => {
    setCompleting(true);
    try {
      await api.patch(`/api/tasks/${id}`, { status: 'completed' });
      setShowConfetti(true);
      toast.success('🎉 Task completed! Great work!');
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.message);
      setCompleting(false);
    }
  };

  const handleDeleteTask = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/tasks/${id}`);
      toast.info('Task deleted');
      navigate('/');
    } catch (err) {
      setError(err.message);
      toast.error('Failed to delete task');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="task-detail-page">
        <div className="loading-state"><div className="loading-spinner" /><p>Loading task…</p></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="task-detail-page">
        <button className="page-back-btn" onClick={() => navigate('/')}>← Back</button>
        <div className="alert alert-error">⚠️ {error || 'Task not found'}</div>
      </div>
    );
  }

  const effectiveState = !task.feasible ? 'negotiate' : task.urgencyState;
  const firstUndoneIdx = task.subtasks?.findIndex(s => s.status !== 'done') ?? -1;

  return (
    <div className="task-detail-page">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {showDeleteModal && (
        <ConfirmModal
          title="Delete task?"
          message={`Are you sure you want to delete "${task.title}"? This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={handleDeleteTask}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      <button className="page-back-btn" onClick={() => navigate('/')}>← Back to dashboard</button>

      <div className="task-detail-header">
        <h1 className="task-detail-title">{task.title}</h1>
        <div className="task-detail-meta">
          <span className={`urgency-badge badge-${effectiveState === 'negotiate' ? 'negotiate' : task.urgencyState}`}>
            <span className="urgency-dot" />
            {effectiveState === 'negotiate' ? 'Infeasible' : (task.urgencyState || 'calm').charAt(0).toUpperCase() + (task.urgencyState || 'calm').slice(1)}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            📅 Due {new Date(task.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        </div>

        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
      </div>

      <div className="detail-sections">
        {/* Negotiate panel — shown BEFORE action panel if feasibility failed */}
        {!task.feasible && (
          <NegotiatePanel task={task} onRefresh={loadTask} />
        )}

        {/* Critical action panel */}
        {task.urgencyState === 'critical' && (
          <ActionPanel task={task} onRefresh={loadTask} />
        )}

        {/* Hero progress section */}
        <HeroProgress task={task} />

        {/* Subtask timeline */}
        <div>
          <div className="section-title">
            Subtasks
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              Press Space to complete next
            </span>
          </div>
          {task.subtasks && task.subtasks.length > 0 ? (
            <div className="timeline">
              {task.subtasks.map((s, i) => (
                <TimelineSubtask
                  key={s.id}
                  subtask={s}
                  taskId={task.id}
                  onRefresh={loadTask}
                  isFirst={i === firstUndoneIdx}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0' }}>
              ⏳ Planning in progress — subtasks will appear shortly…
            </div>
          )}
        </div>

        {/* Activity log */}
        <ActivityLog task={task} />

        {/* Actions row */}
        <div className="task-actions-row">
          <button
            className="btn btn-primary"
            onClick={handleCompleteTask}
            disabled={completing}
          >
            {completing ? '⏳ Completing…' : '✓ Mark task complete'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              try {
                await api.post(`/api/tasks/${id}/replan`);
                toast.info('Task replanned');
                loadTask();
              } catch (err) { setError(err.message); }
            }}
          >
            🔄 Replan
          </button>
          <button
            className="btn btn-ghost btn-danger-outline"
            onClick={() => setShowDeleteModal(true)}
            style={{ marginLeft: 'auto' }}
          >
            🗑 Delete
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
      </div>
    </div>
  );
}
