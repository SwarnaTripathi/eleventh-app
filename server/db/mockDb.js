/**
 * In-memory database used when DEMO_MODE=true.
 * Same interface as firestore.js so all services are storage-agnostic.
 */
const { v4: uuidv4 } = require('uuid');

const store = {
  users: new Map(),
  tasks: new Map(),
  subtasks: new Map(),
  actionDrafts: new Map(),
};

// ── Generic helpers ──────────────────────────────────────────────────────────

function col(name) {
  if (!store[name]) store[name] = new Map();
  return {
    async get(id) {
      const doc = store[name].get(id);
      return doc ? { id, ...doc } : null;
    },
    async set(id, data) {
      store[name].set(id, { ...data });
      return { id, ...data };
    },
    async update(id, data) {
      const existing = store[name].get(id) || {};
      const updated = { ...existing, ...data };
      store[name].set(id, updated);
      return { id, ...updated };
    },
    async delete(id) {
      store[name].delete(id);
    },
    async query(filters = {}) {
      const results = [];
      for (const [id, doc] of store[name].entries()) {
        let match = true;
        for (const [key, val] of Object.entries(filters)) {
          if (doc[key] !== val) { match = false; break; }
        }
        if (match) results.push({ id, ...doc });
      }
      return results;
    },
  };
}

// ── User ─────────────────────────────────────────────────────────────────────

async function upsertUser(userData) {
  const existing = await col('users').get(userData.id);
  if (existing) {
    return col('users').update(userData.id, userData);
  }
  return col('users').set(userData.id, userData);
}

async function getUser(id) {
  return col('users').get(id);
}

// ── Task ─────────────────────────────────────────────────────────────────────

async function createTask(taskData) {
  const id = uuidv4();
  return col('tasks').set(id, { ...taskData, id, createdAt: new Date().toISOString() });
}

async function getTask(id) {
  return col('tasks').get(id);
}

async function getTasksByUser(userId) {
  return col('tasks').query({ userId });
}

async function updateTask(id, data) {
  return col('tasks').update(id, data);
}

async function deleteTask(id) {
  return col('tasks').delete(id);
}

// ── Subtask ───────────────────────────────────────────────────────────────────

async function createSubtask(subtaskData) {
  const id = uuidv4();
  return col('subtasks').set(id, { ...subtaskData, id });
}

async function getSubtasksByTask(taskId) {
  return col('subtasks').query({ taskId });
}

async function updateSubtask(id, data) {
  return col('subtasks').update(id, data);
}

async function deleteSubtasksByTask(taskId) {
  const subtasks = await col('subtasks').query({ taskId });
  for (const s of subtasks) await col('subtasks').delete(s.id);
}

// ── ActionDraft ───────────────────────────────────────────────────────────────

async function createActionDraft(draftData) {
  const id = uuidv4();
  return col('actionDrafts').set(id, {
    ...draftData,
    id,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  });
}

async function getActionDraftsByTask(taskId) {
  return col('actionDrafts').query({ taskId });
}

async function updateActionDraft(id, data) {
  return col('actionDrafts').update(id, data);
}

async function deleteActionDraftsByTask(taskId) {
  const drafts = await col('actionDrafts').query({ taskId });
  for (const d of drafts) await col('actionDrafts').delete(d.id);
}

// ── Seed helpers (dev only) ───────────────────────────────────────────────────

function clearAll() {
  for (const key of Object.keys(store)) store[key].clear();
}

module.exports = {
  upsertUser, getUser,
  createTask, getTask, getTasksByUser, updateTask, deleteTask,
  createSubtask, getSubtasksByTask, updateSubtask, deleteSubtasksByTask,
  createActionDraft, getActionDraftsByTask, updateActionDraft, deleteActionDraftsByTask,
  clearAll,
};
