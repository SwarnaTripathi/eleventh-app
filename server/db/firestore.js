/**
 * Firestore database layer — used when DEMO_MODE=false.
 * Same interface as mockDb.js.
 */
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

let db;
function getDb() {
  if (!db) {
    db = new Firestore({
      projectId: config.GCP_PROJECT,
      // On Cloud Run, ADC is automatic. Locally, set GOOGLE_APPLICATION_CREDENTIALS.
    });
  }
  return db;
}

// ── Generic helpers ──────────────────────────────────────────────────────────

async function fsGet(col, id) {
  const doc = await getDb().collection(col).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function fsSet(col, id, data) {
  await getDb().collection(col).doc(id).set(data);
  return { id, ...data };
}

async function fsUpdate(col, id, data) {
  await getDb().collection(col).doc(id).update(data);
  const doc = await getDb().collection(col).doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function fsDelete(col, id) {
  await getDb().collection(col).doc(id).delete();
}

async function fsQuery(col, filters = []) {
  let ref = getDb().collection(col);
  for (const [field, op, val] of filters) {
    ref = ref.where(field, op, val);
  }
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── User ─────────────────────────────────────────────────────────────────────

async function upsertUser(userData) {
  await getDb().collection('users').doc(userData.id).set(userData, { merge: true });
  return userData;
}

async function getUser(id) {
  return fsGet('users', id);
}

// ── Task ─────────────────────────────────────────────────────────────────────

async function createTask(taskData) {
  const id = uuidv4();
  const data = { ...taskData, id, createdAt: new Date().toISOString() };
  return fsSet('tasks', id, data);
}

async function getTask(id) {
  return fsGet('tasks', id);
}

async function getTasksByUser(userId) {
  return fsQuery('tasks', [['userId', '==', userId]]);
}

async function updateTask(id, data) {
  return fsUpdate('tasks', id, data);
}

async function deleteTask(id) {
  return fsDelete('tasks', id);
}

// ── Subtask ───────────────────────────────────────────────────────────────────

async function createSubtask(subtaskData) {
  const id = uuidv4();
  return fsSet('subtasks', id, { ...subtaskData, id });
}

async function getSubtasksByTask(taskId) {
  return fsQuery('subtasks', [['taskId', '==', taskId]]);
}

async function updateSubtask(id, data) {
  return fsUpdate('subtasks', id, data);
}

async function deleteSubtasksByTask(taskId) {
  const subtasks = await getSubtasksByTask(taskId);
  const batch = getDb().batch();
  for (const s of subtasks) {
    batch.delete(getDb().collection('subtasks').doc(s.id));
  }
  await batch.commit();
}

// ── ActionDraft ───────────────────────────────────────────────────────────────

async function createActionDraft(draftData) {
  const id = uuidv4();
  const data = { ...draftData, id, status: 'proposed', createdAt: new Date().toISOString() };
  return fsSet('actionDrafts', id, data);
}

async function getActionDraftsByTask(taskId) {
  return fsQuery('actionDrafts', [['taskId', '==', taskId]]);
}

async function updateActionDraft(id, data) {
  return fsUpdate('actionDrafts', id, data);
}

function clearAll() {
  console.warn('[firestore] clearAll() is a no-op in production Firestore mode');
}

module.exports = {
  upsertUser, getUser,
  createTask, getTask, getTasksByUser, updateTask, deleteTask,
  createSubtask, getSubtasksByTask, updateSubtask, deleteSubtasksByTask,
  createActionDraft, getActionDraftsByTask, updateActionDraft,
  clearAll,
};
