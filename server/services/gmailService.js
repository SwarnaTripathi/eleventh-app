/**
 * Gmail Service — creates and sends email drafts.
 * Scope used: gmail.compose (not gmail.send).
 * Sending always requires explicit user action.
 */
const { google } = require('googleapis');
const config = require('../config');

function getAuthClient(accessToken) {
  const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function buildRawEmail({ to, subject, body, fromName }) {
  const message = [
    `From: ${fromName || 'Eleventh User'}`,
    to ? `To: ${to}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].filter(Boolean).join('\r\n');

  return Buffer.from(message).toString('base64url');
}

/**
 * Creates a Gmail draft (does not send).
 * Returns the Gmail draft ID.
 */
async function createDraft(accessToken, { to, subject, body, fromName }) {
  if (config.DEMO_MODE) {
    console.log('[gmail] DEMO_MODE — draft not actually created');
    return `demo-draft-${Date.now()}`;
  }

  const auth = getAuthClient(accessToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = buildRawEmail({ to, subject, body, fromName });
  const resp = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });

  return resp.data.id;
}

/**
 * Sends an existing Gmail draft by draft ID.
 * Call only on explicit user confirmation — never automatically.
 */
async function sendDraft(accessToken, draftId) {
  if (config.DEMO_MODE) {
    console.log('[gmail] DEMO_MODE — email not actually sent, draftId:', draftId);
    return { id: draftId, status: 'demo_sent' };
  }

  const auth = getAuthClient(accessToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const resp = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });

  return resp.data;
}

module.exports = { createDraft, sendDraft };
