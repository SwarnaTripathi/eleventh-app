# Eleventh — It's not too late.

Eleventh is an AI-powered task management agent that plans your path to deadlines, escalates when you're falling behind, and takes real action when you're nearly out of time.

It is built as a full-stack web application using React (Vite) for the frontend and Node.js (Express) for the backend. It integrates deeply with Google Workspace (OAuth, Calendar, Gmail) and utilizes Google's Gemini AI to break down tasks, generate intelligent nudges, and draft negotiation emails when deadlines become unfeasible.

## Features

- **Google Workspace Integration:** Secure login via Google OAuth. Connects to your Google Calendar to find free time and schedules tasks dynamically. Integrates with Gmail to draft negotiation emails.
- **AI Task Breakdown (Planner Service):** Uses Gemini to decompose large tasks into manageable 3-8 actionable subtasks with time estimations.
- **Dynamic Scheduling:** Greedy scheduling algorithm fits your subtasks into actual free slots on your Google Calendar before the deadline.
- **Urgency Engine:** A deterministic engine that computes task urgency (calm, attention, critical) based on remaining work and available calendar time.
- **AI Nudges:** Generates context-aware, urgency-appropriate nudge messages using Gemini.
- **Negotiate Service (Novelty):** When time runs out and the deadline is no longer feasible, the AI classifies subtasks into "core" and "cuttable" and proactively drafts a scope-reduction or extension email to send to stakeholders.
- **Demo Mode:** Fully mockable environment for local development without needing real API keys or Google Cloud configurations.

## Tech Stack

- **Frontend:** React 18, Vite, React Router
- **Backend:** Node.js, Express
- **Database:** Google Cloud Firestore (or mock JSON in memory for demo)
- **AI Model:** Google Gemini (via `@google/genai`)
- **Authentication & APIs:** Google OAuth 2.0, Google Calendar API, Gmail API
- **Deployment:** Containerized with Docker, ready for Google Cloud Run.

## Prerequisites

- Node.js 20+
- A Google Cloud project with billing enabled (for production)
- Google Cloud SDK (`gcloud` CLI)

## Quick Start (Demo Mode)

To run the app locally without needing to set up Google Cloud credentials, you can use the built-in Demo Mode.

1. Clone the repository and navigate to the app directory:
   ```bash
   cd app
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
   *Ensure `DEMO_MODE=true` is set in the `.env` file.*
3. Install dependencies:
   ```bash
   npm run install:all
   ```
4. Start the development server (runs both client and server concurrently):
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser. You will be auto-logged in as a demo user.

## Full Setup (Production / Real APIs)

If you want to use real Google Calendar scheduling and Gemini AI generation, please follow the comprehensive [SETUP.md](./SETUP.md) guide.

### Key Environment Variables

When `DEMO_MODE=false`, you will need to configure the following in your `.env`:

- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud OAuth 2.0 credentials.
- `GEMINI_API_KEY`: From Google AI Studio.
- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID for Firestore.
- `JWT_SECRET`: A secure random string.

## Project Structure

- `/client`: React frontend source code, components, styles, and Vite configuration.
- `/server`: Node.js backend logic, including routes, Firestore DB operations, and core services.
  - `/server/services/plannerService.js`: Integrates Gemini for task breakdown and Calendar API for scheduling.
  - `/server/services/urgencyEngine.js`: Calculates deadline feasibility and generates AI nudges.
  - `/server/services/negotiateService.js`: Triggers when deadlines are missed to draft scope cuts and emails.
- `Dockerfile`: Multi-stage build for deploying to Cloud Run.

## License

MIT
