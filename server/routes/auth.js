/**
 * Auth routes — Google OAuth 2.0 + session management.
 * In DEMO_MODE, /auth/demo-login auto-logs in the demo user.
 */
const express = require('express');
const { google } = require('googleapis');
const config = require('../config');
const db = require('../db');
const { signToken, setAuthCookie, DEMO_USER, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── DEMO_MODE: instant login ──────────────────────────────────────────────────

router.post('/auth/demo-login', (req, res) => {
  if (!config.DEMO_MODE) {
    return res.status(403).json({ error: 'Demo login only available in DEMO_MODE' });
  }
  const token = signToken(DEMO_USER);
  setAuthCookie(res, token);
  res.json({ user: { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name } });
});

// ── Google OAuth flow ─────────────────────────────────────────────────────────

function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    `${config.APP_URL}/auth/google/callback`
  );
}

router.get('/auth/google', (req, res) => {
  if (config.DEMO_MODE) {
    return res.redirect('/?demo=true');
  }

  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
  });
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?auth_error=' + encodeURIComponent(error));
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture || null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
    };

    await db.upsertUser(user);

    const token = signToken(user);
    setAuthCookie(res, token);
    res.redirect('/');
  } catch (err) {
    console.error('[auth] OAuth callback error:', err.message);
    res.redirect('/?auth_error=callback_failed');
  }
});

// ── Me + Logout ───────────────────────────────────────────────────────────────

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    picture: req.user.picture || null,
  });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('eleventh_auth');
  res.json({ ok: true });
});

module.exports = router;
