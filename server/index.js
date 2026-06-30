const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const devRoutes = require('./routes/dev');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CORS — in dev, allow Vite dev server; in prod, same origin
if (config.NODE_ENV === 'development') {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:8080'],
    credentials: true,
  }));
}

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dev', devRoutes);

// Public config endpoint (always available — tells frontend about DEMO_MODE)
app.get('/api/config', (req, res) => {
  res.json({
    demoMode: config.DEMO_MODE,
    appName: 'Eleventh',
  });
});

// ── Serve React SPA in production ─────────────────────────────────────────────

const distPath = path.join(__dirname, '..', 'client', 'dist');

if (config.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(config.PORT, () => {
  console.log(`\n🚀 Eleventh server running on http://localhost:${config.PORT}`);
  console.log(`   DEMO_MODE: ${config.DEMO_MODE}`);
  console.log(`   NODE_ENV:  ${config.NODE_ENV}\n`);
});

module.exports = app;
