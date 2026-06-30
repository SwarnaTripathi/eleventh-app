import { useState } from 'react';
import { api } from '../api.js';

export default function NegotiatePanel({ task, onRefresh }) {
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [acceptingScope, setAcceptingScope] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [scopeAccepted, setScopeAccepted] = useState(false);
  const [error, setError] = useState('');

  const scopeDraft = task.actionDrafts?.find(d => d.type === 'negotiate_scope' && d.status === 'proposed');
  const emailDraft = task.actionDrafts?.find(d => d.type === 'negotiate_email' && d.status === 'proposed');

  if (dismissed || (!scopeDraft && !emailDraft)) return null;

  const scopeContent = typeof scopeDraft?.content === 'object'
    ? scopeDraft.content
    : (() => { try { return JSON.parse(scopeDraft?.content || '{}'); } catch { return {}; } })();

  const emailContent = typeof emailDraft?.content === 'object'
    ? emailDraft.content
    : (() => { try { return JSON.parse(emailDraft?.content || '{}'); } catch { return {}; } })();

  const coreSubtasks = scopeContent.core || [];
  const cutSubtasks = scopeContent.cut || [];
  const coreMinutes = coreSubtasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);

  const handleAcceptScope = async () => {
    setAcceptingScope(true);
    setError('');
    try {
      await api.post(`/api/tasks/${task.id}/negotiate/accept-scope`);
      setScopeAccepted(true);
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingScope(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setError('');
    try {
      await api.post(`/api/tasks/${task.id}/negotiate/send`, { to: emailRecipient });
      setEmailSent(true);
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await api.post(`/api/tasks/${task.id}/negotiate/dismiss`);
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="negotiate-panel fade-in">
      <div className="negotiate-panel-header">
        <div className="negotiate-icon">🔮</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span className="urgency-badge badge-negotiate">Feasibility Alert</span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            This can't be finished in time as scoped
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Eleventh has detected that remaining work exceeds available calendar time.
            Here's what it suggests — before you're in crisis.
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleDismiss}
          style={{ flexShrink: 0 }}
        >
          Dismiss
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      {/* Scope trim section */}
      {scopeDraft && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Reduced Scope</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            These core subtasks fit in your available time (~{coreMinutes}m).
            {cutSubtasks.length > 0 && ` ${cutSubtasks.length} subtask${cutSubtasks.length !== 1 ? 's' : ''} would be deferred.`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {coreSubtasks.map((s, i) => (
              <div key={i} className="subtask-item" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <span style={{ color: 'var(--calm)', fontSize: 14 }}>✓</span>
                <span style={{ flex: 1, fontSize: '0.875rem' }}>{s.title}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.estimatedMinutes}m</span>
              </div>
            ))}
            {cutSubtasks.map((s, i) => (
              <div key={i} className="subtask-item subtask-cuttable">
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>✕</span>
                <span style={{ flex: 1, fontSize: '0.875rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{s.title}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>deferred</span>
              </div>
            ))}
          </div>

          {!scopeAccepted ? (
            <button
              id={`accept-scope-${task.id}`}
              className="btn btn-negotiate btn-sm"
              onClick={handleAcceptScope}
              disabled={acceptingScope}
            >
              {acceptingScope ? '⏳ Applying…' : '✓ Accept reduced scope'}
            </button>
          ) : (
            <div className="alert alert-success">✓ Scope applied — cut subtasks marked as deferred</div>
          )}
        </div>
      )}

      <div className="divider" />

      {/* Negotiate email section */}
      {emailDraft && (
        <div>
          <div className="section-title">Extension Request Email</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            Eleventh drafted this for you — review before sending.
          </p>

          <div className="email-preview">
            <div className="email-preview-subject">Subject: {emailContent.subject}</div>
            <div className="email-preview-body">{emailContent.body}</div>
          </div>

          {!emailSent ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="email"
                className="form-input"
                placeholder="Recipient email (optional)"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                style={{ flex: '1 1 200px', padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <button
                id={`send-negotiate-email-${task.id}`}
                className="btn btn-negotiate btn-sm"
                onClick={handleSendEmail}
                disabled={sendingEmail}
              >
                {sendingEmail ? '⏳ Sending…' : '✉️ Send email'}
              </button>
            </div>
          ) : (
            <div className="alert alert-success">✓ Email sent via Gmail</div>
          )}
        </div>
      )}
    </div>
  );
}
