/**
 * Dev-only routes — gated behind DEMO_MODE env var.
 * NEVER expose in production.
 */
const express = require('express');
const config = require('../config');
const db = require('../db');
const { addTimeOffset, resetTimeOffset, getCurrentTime } = require('../services/urgencyEngine');

const router = express.Router();

if (!config.DEMO_MODE) {
  // In production, all dev routes return 404
  router.use('*', (req, res) => res.status(404).json({ error: 'Not found' }));
  module.exports = router;
  return;
}

// ── POST /api/dev/simulate-time ───────────────────────────────────────────────

router.post('/simulate-time', (req, res) => {
  const { offsetMinutes, reset } = req.body;
  if (reset) {
    resetTimeOffset();
    return res.json({ ok: true, simulatedNow: new Date(getCurrentTime()).toISOString(), offsetMinutes: 0 });
  }
  if (typeof offsetMinutes !== 'number') {
    return res.status(400).json({ error: 'offsetMinutes must be a number' });
  }
  addTimeOffset(offsetMinutes * 60000);
  res.json({ ok: true, simulatedNow: new Date(getCurrentTime()).toISOString(), offsetMinutes });
});

router.get('/simulate-time', (req, res) => {
  res.json({
    simulatedNow: new Date(getCurrentTime()).toISOString(),
    realNow: new Date(Date.now()).toISOString(),
    offsetMs: global.timeOffsetMs || 0,
  });
});

// ── POST /api/dev/seed — seed demo tasks ─────────────────────────────────────

router.post('/seed', async (req, res) => {
  try {
    const DEMO_USER_ID = 'demo-user-001';
    const now = getCurrentTime();

    // Clear existing demo data
    const existing = await db.getTasksByUser(DEMO_USER_ID);
    for (const t of existing) await db.deleteTask(t.id);

    // Task 1: Comfortable deadline — Calm state
    const task1 = await db.createTask({
      userId: DEMO_USER_ID,
      title: 'Write Q3 performance review',
      description: 'Complete the quarterly performance review document for the team.',
      deadline: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
      status: 'active',
      urgencyState: 'calm',
      feasible: true,
      freeMinutesBeforeDeadline: 600,
    });

    const subtasks1 = [
      { title: 'Gather performance data and metrics', estimatedMinutes: 30 },
      { title: 'Write individual team member sections', estimatedMinutes: 60 },
      { title: 'Draft summary and recommendations', estimatedMinutes: 45 },
      { title: 'Review and finalise document', estimatedMinutes: 20 },
    ];
    for (const s of subtasks1) {
      await db.createSubtask({ taskId: task1.id, userId: DEMO_USER_ID, ...s, status: 'scheduled', cuttable: false,
        scheduledStart: new Date(now + 60 * 60000).toISOString(),
        scheduledEnd: new Date(now + 90 * 60000).toISOString(),
        calendarEventId: null });
    }

    // Task 2: Tight deadline — Attention state
    const task2 = await db.createTask({
      userId: DEMO_USER_ID,
      title: 'Prepare client presentation slides',
      description: 'Build a 15-slide presentation for the client meeting.',
      deadline: new Date(now + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
      status: 'active',
      urgencyState: 'attention',
      feasible: true,
      freeMinutesBeforeDeadline: 150,
    });

    const subtasks2 = [
      { title: 'Create slide outline and structure', estimatedMinutes: 20 },
      { title: 'Build key slides with data visualisations', estimatedMinutes: 50 },
      { title: 'Add speaker notes and talking points', estimatedMinutes: 25 },
      { title: 'Final review and export', estimatedMinutes: 15 },
    ];
    for (const s of subtasks2) {
      await db.createSubtask({ taskId: task2.id, userId: DEMO_USER_ID, ...s, status: 'scheduled', cuttable: false,
        scheduledStart: new Date(now + 30 * 60000).toISOString(),
        scheduledEnd: new Date(now + 60 * 60000).toISOString(),
        calendarEventId: null });
    }

    // Task 3: Infeasible — triggers Negotiate (deadline soon, too much work, too little free time)
    const task3 = await db.createTask({
      userId: DEMO_USER_ID,
      title: 'Finish assignment report — due tomorrow',
      description: 'Complete and submit the final assignment report for the course.',
      deadline: new Date(now + 18 * 60 * 60 * 1000).toISOString(), // 18 hours
      status: 'active',
      urgencyState: 'attention',
      feasible: false,
      freeMinutesBeforeDeadline: 80, // only 80 min free
    });

    const subtasks3 = [
      { title: 'Complete literature review section', estimatedMinutes: 60, cuttable: false },
      { title: 'Write methodology and data analysis', estimatedMinutes: 90, cuttable: true },
      { title: 'Draft conclusions and recommendations', estimatedMinutes: 45, cuttable: true },
      { title: 'Format references and bibliography', estimatedMinutes: 30, cuttable: false },
      { title: 'Final proofread and submit', estimatedMinutes: 20, cuttable: false },
    ];
    for (const s of subtasks3) {
      await db.createSubtask({ taskId: task3.id, userId: DEMO_USER_ID, ...s, status: 'pending',
        scheduledStart: null, scheduledEnd: null, calendarEventId: null });
    }

    // Pre-create negotiate drafts for task3
    await db.createActionDraft({
      taskId: task3.id,
      userId: DEMO_USER_ID,
      type: 'negotiate_scope',
      content: JSON.stringify({
        core: [
          { id: 'st-demo-1', title: 'Complete literature review section', estimatedMinutes: 60 },
          { id: 'st-demo-2', title: 'Format references and bibliography', estimatedMinutes: 30 },
        ],
        cut: [
          { id: 'st-demo-3', title: 'Write methodology and data analysis', estimatedMinutes: 90, reason: 'Most time-intensive, can be submitted as supplementary later' },
          { id: 'st-demo-4', title: 'Draft conclusions and recommendations', estimatedMinutes: 45, reason: 'Can be shortened to one paragraph in available time' },
        ],
      }),
    });

    await db.createActionDraft({
      taskId: task3.id,
      userId: DEMO_USER_ID,
      type: 'negotiate_email',
      content: JSON.stringify({
        subject: 'Request for brief extension — Assignment Report',
        body: `Dear Professor,\n\nI'm writing proactively regarding my assignment report due tomorrow. After reviewing my schedule, I've identified that completing the full scope to the standard I'd like isn't feasible given my remaining calendar time.\n\nI can deliver the core sections (literature review, references, and a condensed conclusion) by the original deadline. I would appreciate either a 24-hour extension to complete the methodology section, or guidance on submitting a partial version.\n\nI apologize for any inconvenience and appreciate your understanding.\n\nBest regards`,
      }),
    });

    res.json({ ok: true, seeded: { task1: task1.id, task2: task2.id, task3: task3.id } });
  } catch (err) {
    console.error('[dev/seed] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dev/config — expose demo flag to frontend ───────────────────────

router.get('/config', (req, res) => {
  res.json({ demoMode: config.DEMO_MODE });
});

module.exports = router;
