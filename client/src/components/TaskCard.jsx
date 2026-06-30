import { useState, useEffect } from 'react';
import { api } from '../api.js';

// ── Live countdown hook ─────────────────────────────────────────────────────
function useLiveCountdown(deadline) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ms = new Date(deadline).getTime() - now;
  const minutes = ms / 60000;

  if (minutes <= 0) return { text: 'Overdue', minutes: 0 };
  if (minutes < 60) {
    const m = Math.floor(minutes);
    const s = Math.floor((minutes - m) * 60);
    return { text: `${m}m ${s}s`, minutes };
  }
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return { text: m > 0 ? `${h}h ${m}m` : `${h}h`, minutes };
  }
  const d = Math.floor(minutes / (24 * 60));
  const h = Math.floor((minutes % (24 * 60)) / 60);
  return { text: h > 0 ? `${d}d ${h}h` : `${d}d`, minutes };
}

// ── Format deadline ─────────────────────────────────────────────────────────
function formatDeadline(deadline) {
  return new Date(deadline).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Urgency badge ───────────────────────────────────────────────────────────
function UrgencyBadge({ state, feasible }) {
  if (!feasible) {
    return (
      <span className="urgency-badge badge-negotiate">
        <span className="urgency-dot" style={{ background: 'var(--negotiate)' }} />
        Infeasible
      </span>
    );
  }
  const cls = `urgency-badge badge-${state}`;
  const labels = { calm: 'Calm', attention: 'Attention', critical: 'Critical' };
  return (
    <span className={cls}>
      <span className="urgency-dot" />
      {labels[state] || state}
    </span>
  );
}

// ── Circular progress ring ──────────────────────────────────────────────────
function ProgressRing({ subtasks, state, size = 48 }) {
  const done = subtasks?.filter(s => s.status === 'done').length || 0;
  const total = subtasks?.length || 1;
  const pct = Math.round((done / total) * 100);

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const urgencyState = state || 'calm';

  return (
    <div className="progress-ring-wrapper" style={{ width: size, height: size }}>
      <svg className="progress-ring" width={size} height={size}>
        <circle className="progress-ring-bg" cx={size/2} cy={size/2} r={radius} />
        <circle
          className={`progress-ring-fill ${urgencyState}`}
          cx={size/2} cy={size/2} r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="progress-ring-text">{pct}%</span>
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────────────────────
export default function TaskCard({ task, onClick, onRefresh }) {
  const effectiveState = !task.feasible ? 'negotiate' : (task.urgencyState || 'calm');
  const nextSubtask = task.subtasks?.find(s => s.status !== 'done');
  const hasActionDraft = task.actionDrafts?.some(d => d.status === 'proposed');
  const countdown = useLiveCountdown(task.deadline);

  const urgencyClass = effectiveState === 'critical' ? 'critical'
    : effectiveState === 'attention' ? 'attention'
    : 'calm';

  return (
    <div
      id={`task-card-${task.id}`}
      className={`card task-card ${effectiveState} task-card-${effectiveState}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Quick actions on hover */}
      <div className="task-card-quick-actions" onClick={e => e.stopPropagation()}>
        {task.feasible && (
          <button
            className="quick-action-btn"
            title="Replan task"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await api.post(`/api/tasks/${task.id}/replan`);
                onRefresh?.();
              } catch {}
            }}
          >🔄</button>
        )}
        <button
          className="quick-action-btn danger"
          title="Delete task"
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this task?')) return;
            try {
              await api.delete(`/api/tasks/${task.id}`);
              onRefresh?.();
            } catch {}
          }}
        >🗑</button>
      </div>

      <div className="task-card-header">
        <div style={{ flex: 1 }}>
          <h2 className="task-title">{task.title}</h2>
          <p className="task-deadline">Due {formatDeadline(task.deadline)}</p>
        </div>
        <ProgressRing subtasks={task.subtasks} state={task.urgencyState || 'calm'} />
      </div>

      {/* Nudge copy */}
      {task.nudgeCopy && (
        <p style={{
          fontSize: '0.8rem',
          color: effectiveState === 'critical'
            ? 'var(--critical)'
            : effectiveState === 'negotiate'
            ? 'var(--negotiate)'
            : effectiveState === 'attention'
            ? 'var(--attention)'
            : 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 12,
          fontStyle: 'italic',
        }}>
          {task.nudgeCopy}
        </p>
      )}

      {/* Next subtask */}
      {nextSubtask && (
        <div className="next-subtask" style={{ marginTop: 6 }}>
          <span className="next-subtask-label">Next:</span>
          <span style={{ color: 'var(--text-secondary)' }}>{nextSubtask.title}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{nextSubtask.estimatedMinutes}m</span>
        </div>
      )}

      <div className="task-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`live-countdown ${urgencyClass}`}>
            ⏱ {countdown.text}
          </span>
          {task.workLeft > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              · {Math.round(task.workLeft)}m work
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <UrgencyBadge state={task.urgencyState} feasible={task.feasible} />
          {!task.feasible && (
            <span className="negotiate-chip">🔮 Negotiate</span>
          )}
          {hasActionDraft && task.feasible && (
            <span className="urgency-badge badge-critical" style={{ fontSize: '0.7rem' }}>
              ✉️ Draft
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
