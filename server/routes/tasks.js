/**
 * Task routes — full CRUD, subtask management, action drafts, negotiate flow.
 * ALL queries are scoped by req.user.id — never trust client-supplied userId.
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { planTask, getFreeBusyFromCalendar, computeFreeSlots, totalFreeMinutes } = require('../services/plannerService');
const { computeUrgency, feasibilityCheck, generateNudgeCopy, getCurrentTime } = require('../services/urgencyEngine');
const { triggerActionDraft } = require('../services/actionService');
const { triggerNegotiate } = require('../services/negotiateService');
const { createDraft, sendDraft } = require('../services/gmailService');
const config = require('../config');

const router = express.Router();
router.use(requireAuth);

// ── Helper: enrich task with urgency + feasibility ────────────────────────────

async function enrichTask(task, user) {
  const subtasks = await db.getSubtasksByTask(task.id);
  const { state, timeLeftMinutes, workLeft, bufferRatio } = computeUrgency(task, subtasks);

  // Compute feasibility — use cached freeMinutes if stored, else compute from subtasks heuristic
  const freeMinutes = task.freeMinutesBeforeDeadline ?? workLeft * 1.5; // fallback
  const feasible = feasibilityCheck(freeMinutes, workLeft);

  const nudgeCopy = await generateNudgeCopy(state, { ...task, _urgency: { timeLeftMinutes } });

  const actionDrafts = await db.getActionDraftsByTask(task.id);

  // Trigger side effects
  if (state === 'critical') {
    triggerActionDraft(task, subtasks).catch(e => console.error('[tasks] action trigger error:', e.message));
  }
  if (!feasible && task.feasible !== false) {
    // Feasibility just flipped — trigger negotiate
    await db.updateTask(task.id, { feasible: false, urgencyState: state });
    triggerNegotiate(task, subtasks, freeMinutes).catch(e => console.error('[tasks] negotiate trigger error:', e.message));
  }

  // Update cached urgency state
  if (task.urgencyState !== state || task.feasible !== feasible) {
    await db.updateTask(task.id, { urgencyState: state, feasible });
  }

  return {
    ...task,
    urgencyState: state,
    feasible,
    timeLeftMinutes: Math.max(0, timeLeftMinutes),
    workLeft,
    bufferRatio,
    nudgeCopy,
    subtasks,
    actionDrafts: actionDrafts.map(d => ({
      ...d,
      content: (() => {
        try { return JSON.parse(d.content); } catch { return d.content; }
      })(),
    })),
  };
}

// ── POST /api/tasks — create task + trigger planner ──────────────────────────

router.post('/', async (req, res) => {
  try {
    const { title, description, deadline } = req.body;
    if (!title || !deadline) {
      return res.status(400).json({ error: 'title and deadline are required' });
    }

    const task = await db.createTask({
      userId: req.user.id,
      title: String(title).slice(0, 500),
      description: String(description || '').slice(0, 2000),
      deadline,
      status: 'active',
      urgencyState: 'calm',
      feasible: true,
      freeMinutesBeforeDeadline: null,
    });

    // Run planner async (don't block response)
    planTask(task, req.user.id, req.user.accessToken)
      .then(async ({ subtasks, freeMinutesBeforeDeadline }) => {
        await db.updateTask(task.id, { freeMinutesBeforeDeadline });
      })
      .catch(err => console.error('[tasks] planner error:', err.message));

    res.status(201).json(task);
  } catch (err) {
    console.error('[tasks] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks — list all active tasks for user ──────────────────────────

router.get('/', async (req, res) => {
  try {
    const tasks = await db.getTasksByUser(req.user.id);
    const active = tasks.filter(t => t.status === 'active');

    const enriched = await Promise.all(
      active.map(t => enrichTask(t, req.user).catch(err => {
        console.error('[tasks] enrich error for', t.id, err.message);
        return t;
      }))
    );

    enriched.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    res.json(enriched);
  } catch (err) {
    console.error('[tasks] list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id — task detail ─────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(await enrichTask(task, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/tasks/:id/subtasks/:sid — mark subtask done ───────────────────

router.patch('/:id/subtasks/:sid', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const { status } = req.body;
    if (!['pending', 'scheduled', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updated = await db.updateSubtask(req.params.sid, { status });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/tasks/:id — update task (title, deadline, status) ─────────────

router.patch('/:id', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const allowed = {};
    if (req.body.status) allowed.status = req.body.status;
    if (req.body.title) allowed.title = String(req.body.title).slice(0, 500);
    if (req.body.deadline) allowed.deadline = req.body.deadline;

    const updated = await db.updateTask(req.params.id, allowed);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/replan — re-run planner ──────────────────────────────

router.post('/:id/replan', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await db.deleteSubtasksByTask(task.id);
    const { subtasks, freeMinutesBeforeDeadline } = await planTask(task, req.user.id, req.user.accessToken);
    await db.updateTask(task.id, { freeMinutesBeforeDeadline });
    res.json({ subtasks, freeMinutesBeforeDeadline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id/action — get current action draft ─────────────────────

router.get('/:id/action', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const drafts = await db.getActionDraftsByTask(task.id);
    const emailDraft = drafts.find(d => d.type === 'email' && d.status === 'proposed');
    if (!emailDraft) return res.json(null);
    res.json({ ...emailDraft, content: JSON.parse(emailDraft.content || '{}') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/action/send — send action email draft ────────────────

router.post('/:id/action/send', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const drafts = await db.getActionDraftsByTask(task.id);
    const emailDraft = drafts.find(d => d.type === 'email' && d.status === 'proposed');
    if (!emailDraft) return res.status(404).json({ error: 'No email draft found' });

    const content = JSON.parse(emailDraft.content || '{}');
    const { to } = req.body;

    const gmailDraftId = await createDraft(req.user.accessToken, {
      to,
      subject: content.subject,
      body: content.body,
      fromName: req.user.name,
    });

    await sendDraft(req.user.accessToken, gmailDraftId);
    await db.updateActionDraft(emailDraft.id, { status: 'sent' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/action/dismiss ───────────────────────────────────────

router.post('/:id/action/dismiss', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'Task not found' });
    const drafts = await db.getActionDraftsByTask(task.id);
    const emailDraft = drafts.find(d => d.type === 'email' && d.status === 'proposed');
    if (emailDraft) await db.updateActionDraft(emailDraft.id, { status: 'dismissed' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id/negotiate — get negotiate drafts ──────────────────────

router.get('/:id/negotiate', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'Task not found' });

    const drafts = await db.getActionDraftsByTask(task.id);
    const scope = drafts.find(d => d.type === 'negotiate_scope' && d.status === 'proposed');
    const email = drafts.find(d => d.type === 'negotiate_email' && d.status === 'proposed');

    res.json({
      scope: scope ? { ...scope, content: JSON.parse(scope.content || '{}') } : null,
      email: email ? { ...email, content: JSON.parse(email.content || '{}') } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/negotiate/send — send negotiate email ────────────────

router.post('/:id/negotiate/send', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'Task not found' });

    const drafts = await db.getActionDraftsByTask(task.id);
    const emailDraft = drafts.find(d => d.type === 'negotiate_email' && d.status === 'proposed');
    if (!emailDraft) return res.status(404).json({ error: 'No negotiate email draft found' });

    const content = JSON.parse(emailDraft.content || '{}');
    const { to } = req.body;

    const gmailDraftId = await createDraft(req.user.accessToken, {
      to,
      subject: content.subject,
      body: content.body,
      fromName: req.user.name,
    });

    await sendDraft(req.user.accessToken, gmailDraftId);
    await db.updateActionDraft(emailDraft.id, { status: 'sent' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/negotiate/accept-scope — apply trimmed scope ─────────

router.post('/:id/negotiate/accept-scope', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'Task not found' });

    const drafts = await db.getActionDraftsByTask(task.id);
    const scopeDraft = drafts.find(d => d.type === 'negotiate_scope' && d.status === 'proposed');
    if (!scopeDraft) return res.status(404).json({ error: 'No scope draft found' });

    const scopeContent = JSON.parse(scopeDraft.content || '{}');
    const cutIds = (scopeContent.cut || []).map(s => s.id).filter(Boolean);

    // Mark cut subtasks as abandoned
    await Promise.all(cutIds.map(id => db.updateSubtask(id, { status: 'done', cuttable: true })));
    await db.updateActionDraft(scopeDraft.id, { status: 'sent' });

    res.json({ ok: true, cutCount: cutIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks/:id/negotiate/dismiss ────────────────────────────────────

router.post('/:id/negotiate/dismiss', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'Task not found' });
    const drafts = await db.getActionDraftsByTask(task.id);
    const neg = drafts.filter(d => ['negotiate_scope', 'negotiate_email'].includes(d.type) && d.status === 'proposed');
    await Promise.all(neg.map(d => db.updateActionDraft(d.id, { status: 'dismissed' })));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tasks/:id — delete task and related data ─────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const task = await db.getTask(req.params.id);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    // Delete subtasks and action drafts first
    if (db.deleteSubtasksByTask) await db.deleteSubtasksByTask(task.id);
    if (db.deleteActionDraftsByTask) await db.deleteActionDraftsByTask(task.id);
    await db.deleteTask(task.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks] delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
