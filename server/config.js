require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'eleventh-dev-secret-replace-in-prod',
  APP_URL: process.env.APP_URL || 'http://localhost:8080',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GCP_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || '',
};
