# Eleventh — Cloud Run Deployment Script
# Run this AFTER:
#   1. gcloud auth login (done interactively)
#   2. OAuth credentials created and filled in below
#
# Usage: .\deploy.ps1

# ── Fill these in before running ──────────────────────────────────────────────
$PROJECT_ID      = "eleventh-app"
$GEMINI_API_KEY  = "YOUR_GEMINI_API_KEY"
$CLIENT_ID       = "YOUR_CLIENT_ID"
$CLIENT_SECRET   = "YOUR_CLIENT_SECRET"
$REGION          = "us-central1"
$SERVICE_NAME    = "eleventh"
$JWT_SECRET      = "YOUR_JWT_SECRET"

# ── Step 1: Set project ───────────────────────────────────────────────────────
Write-Host "`n[1/6] Setting project..." -ForegroundColor Cyan
gcloud config set project $PROJECT_ID

# ── Step 2: Enable required APIs ─────────────────────────────────────────────
Write-Host "`n[2/6] Enabling APIs (this takes ~60s)..." -ForegroundColor Cyan
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    firestore.googleapis.com `
    calendar-json.googleapis.com `
    gmail.googleapis.com `
    generativelanguage.googleapis.com

# ── Step 3: Create Firestore database ────────────────────────────────────────
Write-Host "`n[3/6] Creating Firestore database..." -ForegroundColor Cyan
gcloud firestore databases create --location=$REGION 2>&1 | Out-Null
Write-Host "Firestore ready (may already exist - that's fine)"

# ── Step 4: Grant Cloud Run SA permission to use Firestore ───────────────────
Write-Host "`n[4/6] Setting IAM permissions..." -ForegroundColor Cyan
$PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
$SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA" `
    --role="roles/datastore.user" | Out-Null

# ── Step 5: Deploy to Cloud Run ──────────────────────────────────────────────
Write-Host "`n[5/6] Deploying to Cloud Run (builds Docker image in cloud, ~3-4 min)..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --source . `
    --region $REGION `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,DEMO_MODE=false,PORT=8080,GEMINI_API_KEY=$GEMINI_API_KEY,GOOGLE_CLIENT_ID=$CLIENT_ID,GOOGLE_CLIENT_SECRET=$CLIENT_SECRET,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,JWT_SECRET=$JWT_SECRET,APP_URL=PLACEHOLDER" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=3

# ── Step 6: Get URL and patch APP_URL ────────────────────────────────────────
Write-Host "`n[6/6] Getting service URL..." -ForegroundColor Cyan
$SERVICE_URL = (gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
Write-Host "`n✅ Deployed to: $SERVICE_URL" -ForegroundColor Green

# Patch APP_URL now that we know the real URL
gcloud run services update $SERVICE_NAME `
    --region $REGION `
    --update-env-vars="APP_URL=$SERVICE_URL"

Write-Host "

--------------------------------------------------
  🚀 Eleventh is live at: $SERVICE_URL
--------------------------------------------------

  NEXT: Add this OAuth redirect URI in GCP Console:
  $SERVICE_URL/auth/google/callback

  -> APIs and Services -> Credentials -> your OAuth client
  -> Add to Authorized redirect URIs -> Save
--------------------------------------------------
" -ForegroundColor Green
