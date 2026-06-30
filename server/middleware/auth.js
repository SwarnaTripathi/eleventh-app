/**
 * Auth middleware.
 * - DEMO_MODE: auto-injects a hardcoded demo user, no OAuth required.
 * - Production: validates JWT from httpOnly cookie.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@eleventh.app',
  name: 'Demo User',
  picture: null,
  accessToken: 'demo-access-token',
  refreshToken: 'demo-refresh-token',
};

// Seed demo user into DB on startup
if (config.DEMO_MODE) {
  db.upsertUser(DEMO_USER).catch(() => {});
}

/**
 * Signs a JWT for a user. Call this after successful OAuth.
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Sets the auth cookie on the response.
 */
function setAuthCookie(res, token) {
  res.cookie('eleventh_auth', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Express middleware: requires authenticated user.
 * Sets req.user on success, returns 401 on failure.
 */
function requireAuth(req, res, next) {
  if (config.DEMO_MODE) {
    req.user = DEMO_USER;
    return next();
  }

  const token = req.cookies?.eleventh_auth;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.clearCookie('eleventh_auth');
    return res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

/**
 * Optional auth — sets req.user if token present but doesn't block.
 */
function optionalAuth(req, res, next) {
  if (config.DEMO_MODE) {
    req.user = DEMO_USER;
    return next();
  }

  const token = req.cookies?.eleventh_auth;
  if (token) {
    try {
      req.user = jwt.verify(token, config.JWT_SECRET);
    } catch {
      // ignore invalid token
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, signToken, setAuthCookie, DEMO_USER };
