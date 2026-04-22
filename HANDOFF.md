# OMI-TED — Full Handoff Document

> Written for the next Claude session. Read this entire file before touching anything.
> Finish this app in 4–5 follow-ups. Everything you need is here.

---

## TL;DR — What To Do First (In Order)

1. **Fix Railway builder** (UI change, takes 2 minutes) — see Section 6
2. **Add Railway env vars** — see Section 7
3. **Update Vercel `NEXT_PUBLIC_API_BASE`** to the Railway URL
4. **Test the golden path** — add video → ingest → translate → approve
5. **Fix any runtime bugs** from testing

The code is done. The only thing blocking a working app is the Railway deployment configuration.

---

## 1. App Overview

**OMI-TED** (OMI Telugu English Dubbing) is a Telugu → English translation platform for Christian ministry YouTube videos.

Flow:
1. Paste a YouTube URL → backend fetches transcript via `youtube-transcript-api`
2. Transcript is split into timed segments stored in PostgreSQL
3. Segments are sent to any LLM via OpenRouter for translation
4. Human reviewer edits/approves translations in a parallel editor UI
5. Approved translations exported as a dataset

**Key design principle**: LLM-agnostic. All translation goes through OpenRouter (`https://openrouter.ai/api/v1/chat/completions`). Users can select any model (Gemma, Llama, Claude, GPT-4o, etc.) from a searchable dropdown. They can also supply their own API key per-request.

---

## 2. Architecture

```
┌─────────────────────────────────────────┐
│  FRONTEND (Next.js 14 App Router)       │
│  Branch: omi-ted-frontend               │
│  Deploy: Vercel                         │
│  Dir: /frontend                         │
└────────────────┬────────────────────────┘
                 │ NEXT_PUBLIC_API_BASE
                 ▼
┌─────────────────────────────────────────┐
│  BACKEND (FastAPI + asyncpg)            │
│  Branch: omi-ted-backend                │
│  Deploy: Railway (needs fixing)         │
│  Dir: /backend                          │
└────────────────┬────────────────────────┘
                 │ DATABASE_URL
                 ▼
┌─────────────────────────────────────────┐
│  PostgreSQL (Railway plugin)            │
│  Auto-provisioned, auto-connected       │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  OpenRouter API                         │
│  https://openrouter.ai/api/v1           │
│  Routes to ANY LLM (Claude/GPT/Gemma)   │
└─────────────────────────────────────────┘
```

---

## 3. Live URLs

| Service | URL | Status |
|---------|-----|--------|
| Frontend (new OMI-TED) | `https://omi-automation-gb9p-git-omi-te-847b91-rakshan-rakshans-projects.vercel.app/videos` | ✅ Live |
| Backend (Railway) | TBD — not yet working | ❌ Broken |
| **OLD Sarvam app** | `https://omi-automation-gb9p.vercel.app/` | ⛔ DO NOT TOUCH |

> **CRITICAL**: Never push to `main` branch. Never touch the old Sarvam app URL. The owner was explicit — that is a separate production app and must not be broken.

---

## 4. Repository & Branch Guide

**Repo**: `rakshan-rakshan/omi-automation`

| Branch | Purpose | Deploy target |
|--------|---------|---------------|
| `omi-ted-backend` | FastAPI Python backend | Railway |
| `omi-ted-frontend` | Next.js 14 frontend | Vercel |
| `main` | Old Sarvam app (DO NOT TOUCH) | Vercel production |

All backend code changes → `omi-ted-backend`
All frontend code changes → `omi-ted-frontend`

---

## 5. What Is Already Built (Complete)

### Backend (`omi-ted-backend` branch)

```
backend/
├── api/
│   ├── main.py              # FastAPI app, lifespan DB init, CORS
│   ├── deps.py              # DB session dependency injection
│   └── routes/
│       ├── ingest.py        # POST /ingest/video, GET /ingest/video/{id}/segments
│       ├── translate.py     # POST /translate/segment/{id}, /translate/video/{id},
│       │                    #   /translate/segment/{id}/approve, /edit
│       ├── models.py        # GET /models, GET /models/available (OpenRouter proxy),
│       │                    #   GET /models/{id}
│       ├── dataset.py       # Dataset export endpoints
│       └── reports.py       # Reporting endpoints
├── config/
│   └── settings.py          # Pydantic settings, auto-fixes DATABASE_URL format
├── db/
│   ├── database.py          # Async SQLAlchemy engine (asyncpg)
│   ├── init_db.py           # Runs schema.sql at startup (idempotent)
│   └── schema.sql           # Full PostgreSQL schema (idempotent, safe to re-run)
└── services/
    └── translation/
        ├── router.py         # Tier-based routing (best/good/cheap) + model override
        └── openrouter_client.py  # httpx client for OpenRouter + per-request api_key
```

**Deployment files at repo root:**
- `Dockerfile` — Python 3.11-slim, copies `backend/`, runs uvicorn
- `railway.json` — `"builder": "DOCKERFILE"`, start command, health check
- `nixpacks.toml` — Forces Python build if nixpacks is used
- `Procfile` — `web: uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT`
- `requirements.txt` — all Python dependencies

**Key backend behaviours:**
- `settings.py` auto-converts `postgresql://` → `postgresql+asyncpg://` (Railway compat)
- `init_db.py` runs `schema.sql` at startup via asyncpg — tables created on first boot
- Translation supports optional `model_id` (any OpenRouter model string) that bypasses tiers
- Translation supports `X-Api-Key` request header → user's own OpenRouter key
- `GET /models/available` proxies OpenRouter's full model catalog
- `GET /health` → `{"status": "ok"}` (Railway health check)

### Frontend (`omi-ted-frontend` branch)

```
frontend/
├── app/(dashboard)/
│   ├── layout.tsx           # Sidebar layout with nav
│   ├── videos/
│   │   ├── page.tsx         # Video list + "Add YouTube URL" form
│   │   └── [id]/page.tsx    # Video detail page
│   ├── models/page.tsx      # Model registry ("Registered" tab + "Available" tab)
│   └── settings/page.tsx    # App settings + API keys (stored in localStorage)
├── components/
│   ├── editor/
│   │   └── ParallelEditor.tsx  # Side-by-side translation editor with model selector
│   └── models/
│       └── ModelSelector.tsx   # Searchable dropdown of all OpenRouter models
└── lib/
    └── api.ts               # Typed API client (all endpoints, model_id + api_key support)
```

**Key frontend behaviours:**
- `NEXT_PUBLIC_API_BASE` env var sets the backend URL (must be set on Vercel)
- API keys stored in `localStorage` under key `omited_api_keys` — never sent to server config
- `getStoredApiKeys()` in `api.ts` reads localStorage and passes `openrouter` key as `X-Api-Key` header
- ModelSelector loads full catalog from `GET /api/v1/models/available`
- ParallelEditor shows tier buttons (Best/Good/Draft) + Custom Model option
- Settings page has masked inputs for OpenRouter, Anthropic, OpenAI, Google API keys

---

## 6. THE BLOCKING ISSUE — Railway Runs Node.js Instead of Python

### Root cause
The `omi-ted-backend` branch inherited `package.json` + `next.config.js` + `src/` from the old Sarvam frontend. Railway's auto-detection finds `package.json` and builds Node.js (Next.js) instead of Python, ignoring the `Dockerfile`.

Attempts already made (all failed because Railway UI overrides code config):
- Added `nixpacks.toml` with Python config
- Added `Procfile`
- `railway.json` set to both `DOCKERFILE` and `NIXPACKS` builders

### The fix (MANUAL — must be done in Railway UI)

1. Go to **railway.app** → your OMI-TED backend service
2. Click **Settings** tab
3. Find the **Build** section
4. Change **Builder** from Auto/Nixpacks → **"Dockerfile"**
5. Set **Dockerfile Path** to `Dockerfile`
6. Clear the **Start Command** field (let Dockerfile CMD take over, or set it to `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT`)
7. Click **Save**
8. Click **Deploy** (or push a dummy commit to trigger)

### How to verify it worked
Railway build logs should show:
```
Step 1: FROM python:3.11-slim
Step 2: WORKDIR /app
Step 3: COPY requirements.txt ./
Step 4: RUN pip install ...
```
NOT `npm run build` or `node` anything.

After deploy, hit: `https://YOUR-RAILWAY-URL.up.railway.app/health`
Expected: `{"status": "ok", "version": "0.1.0"}`

And in Railway logs:
```
Database schema initialized successfully
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:PORT
```

---

## 7. Environment Variables

### Railway (backend service)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | auto-set | Railway PostgreSQL plugin sets this automatically |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | **Required** — get from openrouter.ai |
| `CORS_ORIGINS` | `https://omi-automation-gb9p-git-omi-te-847b91-rakshan-rakshans-projects.vercel.app` | Frontend Vercel URL |
| `MODEL_BEST` | `anthropic/claude-opus-4-7` | Optional — this is the default |
| `MODEL_GOOD` | `anthropic/claude-sonnet-4-6` | Optional — this is the default |
| `MODEL_CHEAP` | `anthropic/claude-haiku-4-5` | Optional — this is the default |

### Vercel (frontend service)

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_API_BASE` | `https://YOUR-RAILWAY-URL.up.railway.app` | **Required** — must match Railway URL exactly, no trailing slash |

> The user has already set `NEXT_PUBLIC_API_BASE` on Vercel but with a placeholder value. Once Railway is up, update it to the real Railway URL and redeploy Vercel.

---

## 8. Step-by-Step to Finish (4–5 Follow-ups)

### Follow-up 1: Get Railway running
1. User changes Railway builder to Dockerfile (Section 6 above)
2. User adds `OPENROUTER_API_KEY` and `CORS_ORIGINS` env vars to Railway
3. Railway auto-provisions PostgreSQL — `DATABASE_URL` is set automatically
4. Verify: `GET /health` returns 200
5. Verify: `GET /docs` shows FastAPI Swagger UI

### Follow-up 2: Connect frontend to backend
1. Get the Railway URL (from Railway dashboard → your service)
2. Update `NEXT_PUBLIC_API_BASE` on Vercel to the Railway URL
3. Trigger Vercel redeploy
4. Open frontend → Videos page → should load without errors

### Follow-up 3: Test end-to-end golden path
1. Add a YouTube video URL (a Telugu video with subtitles)
2. Wait for ingestion (watch status change from `pending` → `fetching` → `complete`)
3. Open the video → should show segments with Telugu text
4. Click "Translate" on a segment with the Good tier
5. Translation should appear in the English column
6. Approve the translation
7. Check the Models page → Available tab should show OpenRouter catalog

### Follow-up 4: Fix any bugs found in testing
Likely issues to watch for:
- Ingest failing: check `youtube-transcript-api` is finding transcripts for the test video
- Translation failing: check `OPENROUTER_API_KEY` is set and valid
- CORS errors: check `CORS_ORIGINS` includes the exact Vercel URL
- Models `/available` empty: might need an API key in Settings page first

### Follow-up 5 (if needed): Polish
- Video list pagination
- Batch translate entire video
- Export approved translations as CSV/JSONL

---

## 9. API Endpoints Reference

```
GET  /health                                    → {status: ok}
GET  /docs                                      → Swagger UI

POST /api/v1/ingest/video                       → {youtube_url} → Video
GET  /api/v1/ingest/video/{id}                  → Video
GET  /api/v1/ingest/video/{id}/segments         → SegmentListResponse

POST /api/v1/translate/segment/{id}             → {tier, model_id?, set_active}
POST /api/v1/translate/video/{id}               → {tier, model_id?, concurrency, skip_songs}
GET  /api/v1/translate/video/{id}/status        → VideoTranslationStatus
POST /api/v1/translate/segment/{id}/approve     → {reviewer_id?}
POST /api/v1/translate/segment/{id}/edit        → {english_text, reviewer_id?, notes?}

GET  /api/v1/models                             → [Model] (from DB registry)
GET  /api/v1/models/available                   → [OpenRouterModel] (live from OpenRouter)
GET  /api/v1/models/{id}                        → Model
```

**Translation model override** (any endpoint):
- Pass `model_id: "google/gemma-2-9b-it"` in request body to use any OpenRouter model
- Pass `X-Api-Key: sk-or-v1-...` header to use user's own OpenRouter key

---

## 10. Key Files — What Does What

| File | Purpose | When to edit |
|------|---------|---------------|
| `backend/config/settings.py` | All env var config, DATABASE_URL fix | Adding new env vars |
| `backend/db/schema.sql` | DB tables (idempotent) | Adding new columns/tables |
| `backend/db/init_db.py` | Runs schema at startup | Usually don't touch |
| `backend/services/translation/openrouter_client.py` | OpenRouter HTTP calls | Changing LLM API |
| `backend/services/translation/router.py` | Tier→model mapping, translation prompt | Changing prompt or model defaults |
| `backend/api/routes/translate.py` | Translation REST endpoints | Adding translation features |
| `backend/api/routes/ingest.py` | YouTube ingest endpoint | Fixing transcript fetching |
| `backend/api/routes/models.py` | Model registry + OpenRouter proxy | Changing model catalog |
| `frontend/lib/api.ts` | All API calls from frontend | Adding new API calls |
| `frontend/components/editor/ParallelEditor.tsx` | The main editor UI | Changing translation workflow |
| `frontend/components/models/ModelSelector.tsx` | Model picker dropdown | Changing model selection UX |
| `frontend/app/(dashboard)/settings/page.tsx` | Settings + API key inputs | Adding new settings |
| `Dockerfile` | Backend container | Changing Python version or deps |
| `railway.json` | Railway deployment config | Changing start command or health check |

---

## 11. Database Schema Summary

All tables are created automatically at backend startup via `init_db.py` → `schema.sql`.

| Table | Purpose |
|-------|---------|
| `videos` | YouTube video metadata + fetch status |
| `segments` | Time-coded transcript segments with all translation columns |
| `translations` | Translation history per segment (model, cost, tokens) |
| `reviews` | Human review audit trail |
| `model_registry` | Admin DB of known models (separate from OpenRouter live catalog) |
| `glossary_terms` | Telugu→English term overrides used in prompts |
| `idioms` | Telugu idioms with contextual translations |
| `batch_jobs` | Background job tracking |
| `users` | Reviewer accounts |

---

## 12. Translation System — How It Works

```
Frontend user selects:
  ├── Tier button (Best/Good/Draft)  →  backend picks MODEL_BEST/GOOD/CHEAP env var
  └── Custom Model (ModelSelector)  →  sends model_id = "google/gemma-2-9b-it"

Backend TranslationRouter:
  1. Resolves model: model_id ?? tier_models[tier]
  2. Builds system prompt with glossary + idioms from DB
  3. Calls OpenRouterClient.complete(model, system, user_message, api_key?)
  4. OpenRouter routes to actual LLM
  5. Result stored in segments table (english_good_model / english_best_model / etc.)
  6. Translation record stored in translations table
```

---

## 13. Known Issues & Gotchas

1. **Railway builds Node.js** — the only fix is changing builder to Dockerfile in Railway UI (code-level fixes were tried and failed)

2. **`pgvector` in requirements.txt** — the Python package is installed but NOT imported. The vector extension was removed from schema.sql. No error, just wasted install time. Can clean up later.

3. **`openai`, `anthropic`, `google-generativeai` in requirements.txt** — these are dead code. Backend only uses httpx → OpenRouter. Don't import them anywhere. Can clean up later.

4. **`model_registry` will be empty** — on first boot, the `model_registry` table has no rows. The `/api/v1/models` endpoint returns an empty list. The frontend falls back to hardcoded placeholder models. This is fine — the real model catalog comes from `/api/v1/models/available` (live from OpenRouter).

5. **`translations.model_id` is nullable** — intentional. The FK to `model_registry` is NULL for most translations since we use OpenRouter model strings directly, not DB-registered models.

6. **Frontend API keys** — stored only in `localStorage` as `omited_api_keys`. Key `openrouter` is sent as `X-Api-Key` header on translate calls. If no key is set, backend uses its own `OPENROUTER_API_KEY` env var.

7. **CORS** — `CORS_ORIGINS` on Railway must include the exact Vercel URL. If you get CORS errors in the browser, this is why.

8. **Song detection** — `is_song` column on segments defaults to `false`. There's no active ML song detection yet. Setting is `auto_detect_songs` in frontend settings but backend doesn't implement it yet.

9. **`youtube-transcript-api`** — only works for videos that have YouTube auto-captions or manual subtitles enabled. Videos without any captions will fail ingestion.

---

## 14. Do Not Touch

- `main` branch — old Sarvam app, production
- `https://omi-automation-gb9p.vercel.app/` — old Sarvam frontend, production
- Any files not in `omi-ted-backend` or `omi-ted-frontend` branches

---

## 15. Quick Start Checklist for Next Session

```
[ ] 1. Read this document fully
[ ] 2. Ask user: "Is Railway now showing Python build logs?"
[ ] 3. If NO → walk user through Railway UI change (Section 6)
[ ] 4. If YES → get Railway URL from user
[ ] 5. Check Railway has OPENROUTER_API_KEY set
[ ] 6. Check Vercel has NEXT_PUBLIC_API_BASE = Railway URL
[ ] 7. Hit GET /health on Railway URL → expect {"status":"ok"}
[ ] 8. Open frontend Videos page → no errors
[ ] 9. Add a test YouTube video URL → watch ingestion
[ ] 10. Translate one segment → check OpenRouter key works
[ ] 11. Done → app is live
```

---

*Last updated: 2026-04-22 by Claude Sonnet 4.6 session*
*Repo: rakshan-rakshan/omi-automation*
*Backend branch: omi-ted-backend | Frontend branch: omi-ted-frontend*
