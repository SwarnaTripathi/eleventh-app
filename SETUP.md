# Eleventh — Setup Guide

## Prerequisites
- Node.js 20+
- Google Cloud SDK (`gcloud` CLI)
- A Google Cloud project with billing enabled

---

## Step 1: Enable Google Cloud APIs

Run in your terminal (replace `YOUR_PROJECT_ID`):

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  calendar-json.googleapis.com \
  gmail.googleapis.com \
  generativelanguage.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Step 2: Create Firestore Database

In [GCP Console → Firestore](https://console.cloud.google.com/firestore):
- Click **Create Database**
- Choose **Native mode**
- Region: `us-central1` (or closest to you)

---

## Step 3: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key — this is your `GEMINI_API_KEY`

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to [GCP Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Eleventh`
5. Authorized redirect URIs — add both:
   - `http://localhost:8080/auth/google/callback` (local dev)
   - `https://YOUR_CLOUD_RUN_URL/auth/google/callback` (production — add after first deploy)
6. Copy **Client ID** and **Client Secret**

---

## Step 5: Configure OAuth Consent Screen

In [GCP Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent):
- User type: **External** (for demo), or Internal if using a Workspace org
- Add scopes:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/gmail.compose`
  - `openid`, `email`, `profile`
- Add your email as a **test user**

---

## Step 6: Local Development

```bash
# Clone and install
cd e:/vibe2ship/app
cp .env.example .env
# Fill in .env with your keys (or leave DEMO_MODE=true for mock mode)

npm install       # installs root devDeps (concurrently)
npm run install:all  # installs server + client deps

# Start dev server (hot-reload)
npm run dev
# → client: http://localhost:5173
# → server: http://localhost:8080
```

---

## Step 7: Deploy to Cloud Run

```bash
cd e:/vibe2ship/app

gcloud run deploy eleventh \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,\
DEMO_MODE=false,\
GEMINI_API_KEY=YOUR_KEY,\
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID,\
GOOGLE_CLIENT_SECRET=YOUR_SECRET,\
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,\
JWT_SECRET=YOUR_LONG_RANDOM_SECRET,\
APP_URL=https://YOUR_CLOUD_RUN_URL"
```

After first deploy, copy the Cloud Run URL and add it to the OAuth 2.0 redirect URIs (Step 4).

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DEMO_MODE` | No (default: false) | `true` = mock all APIs, auto-login demo user |
| `PORT` | No (default: 8080) | HTTP port |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | Yes (prod) | Long random string for JWT signing |
| `APP_URL` | Yes (prod) | Full URL of the app (for OAuth redirect) |
| `GOOGLE_CLIENT_ID` | Yes (prod) | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes (prod) | OAuth 2.0 Client Secret |
| `GEMINI_API_KEY` | Yes (prod) | Gemini API key from AI Studio |
| `GOOGLE_CLOUD_PROJECT` | Yes (prod) | GCP project ID for Firestore |
