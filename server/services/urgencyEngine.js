/**
 * Urgency Engine — deterministic, no LLM calls for state computation.
 * Gemini is used ONLY for nudge copy generation, after state is known.
 */
const config = require('../config');
const { GoogleGenAI } = require('@google/genai');

let genAI;
if (!config.DEMO_MODE && config.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
}

// ── Time simulation (dev only) ────────────────────────────────────────────────
// global.timeOffsetMs is set by the /api/dev/simulate-time route
function getCurrentTime() {
  const offset = global.timeOffsetMs || 0;
  return Date.now() + offset;
}

function resetTimeOffset() {
  global.timeOffsetMs = 0;
}

function addTimeOffset(ms) {
  global.timeOffsetMs = (global.timeOffsetMs || 0) + ms;
}

// ── Urgency formula ───────────────────────────────────────────────────────────

/**
 * Computes urgency state for a task given its subtasks.
 * Pure, deterministic — no LLM.
 *
 * @param {object} task - Task record with deadline field
 * @param {Array}  subtasks - Subtask records
 * @returns {{ state, timeLeftMinutes, workLeft, bufferRatio }}
 */
function computeUrgency(task, subtasks) {
  const now = getCurrentTime();
  const deadline = new Date(task.deadline).getTime();
  const timeLeftMs = deadline - now;
  const timeLeftMinutes = timeLeftMs / 60000;

  const workLeft = subtasks
    .filter(s => s.status !== 'done')
    .reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

  if (timeLeftMinutes <= 0) {
    return { state: 'critical', timeLeftMinutes: 0, workLeft, bufferRatio: 0 };
  }

  if (workLeft === 0) {
    return { state: 'calm', timeLeftMinutes, workLeft: 0, bufferRatio: Infinity };
  }

  const bufferRatio = timeLeftMinutes / workLeft;

  let state;
  if (bufferRatio > 3) state = 'calm';
  else if (bufferRatio > 1.2) state = 'attention';
  else state = 'critical';

  return { state, timeLeftMinutes, workLeft, bufferRatio };
}

// ── Feasibility check ─────────────────────────────────────────────────────────

/**
 * Checks whether remaining free calendar time covers remaining work.
 * Deterministic — no LLM.
 *
 * @param {number} freeMinutesBeforeDeadline
 * @param {number} workLeft - total estimated minutes of unfinished subtasks
 * @returns {boolean}
 */
function feasibilityCheck(freeMinutesBeforeDeadline, workLeft) {
  if (workLeft === 0) return true;
  return freeMinutesBeforeDeadline >= workLeft;
}

// ── Nudge copy generation (Gemini, called after state is known) ───────────────

const MOCK_NUDGE = {
  calm: "You're on track! Keep the momentum going.",
  attention: "This task needs your focus soon — make time for it today.",
  critical: "⚠️ Time is running out. Take action on this now.",
};

/**
 * Generates urgency-appropriate nudge copy using Gemini.
 * Falls back to static copy in DEMO_MODE or if Gemini is unavailable.
 */
async function generateNudgeCopy(state, task) {
  if (config.DEMO_MODE || !genAI) {
    return MOCK_NUDGE[state] || MOCK_NUDGE.calm;
  }

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{
            text: `You are a productivity assistant. Write a short nudge message (1-2 sentences, no emojis except for critical) for a task management app.

TASK: "${task.title}"
URGENCY STATE: ${state}

State guidelines:
- calm: warm, encouraging, mention they're on track
- attention: firm, focused, mention they should prioritise soon  
- critical: urgent and direct, mention immediate action needed, use one ⚠️ emoji

Return ONLY the nudge message. No quotes, no labels.`
          }]
        }
      ],
    });
    return (response.text || MOCK_NUDGE[state]).trim();
  } catch (err) {
    console.error('[urgencyEngine] nudge copy error:', err.message);
    return MOCK_NUDGE[state];
  }
}

module.exports = {
  getCurrentTime,
  resetTimeOffset,
  addTimeOffset,
  computeUrgency,
  feasibilityCheck,
  generateNudgeCopy,
};
