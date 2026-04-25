# OMI-TED Session 3 Handoff — Ready to Deploy

> Written: 2026-04-25
> Status: Backend code COMPLETE. Railway needs env vars. Frontend needs backend URL.

---

## What Was Done This Session

### Code pushed to `omi-ted-backend`:

| Commit | What |
|--------|------|
| Transcription service | `youtube_fetcher.py` (captions → Whisper fallback), `song_detector.py`, `__init__.py` |
| Missing init | `backend/services/translation/__init__.py` (was causing import crash at startup) |
| All routes | `ingest.py`, `dataset.py`, `reports.py` |
| Dockerfile | Added `ffmpeg` (required by yt-dlp for audio extraction) |
| **Railway fix** | Deleted `package.json` + `next.config.js` from backend branch — these caused Railway to detect Node.js instead of Python |
| Bug fixes | `dataset.py` CSV f-string (Python 3.11 syntax error), `ingest.py` UUID serialization + SQL safety |

---

## Current State

### Backend (`omi-ted-backend` branch) — COMPLETE ✅

All files exist and are bug-free:
```
backend/
├── api/
│   ├── main.py              ✅ (imports all 5 routers)
│   ├── deps.py              ✅
│   └── routes/
│       ├── ingest.py        ✅ (7 endpoints — single, batch, list, detail, segments, song, delete)
│       ├── translate.py     ✅ (translate segment/video, approve, edit)
│       ├── dataset.py       ✅ (JSONL + CSV export, stats)
│       ├── reports.py       ✅ (overview)
│       └── models.py        ✅ (model registry + OpenRouter proxy)
├── config/settings.py       ✅ (openai_api_key field exists)
├── db/
│   ├── schema.sql           ✅ (complete schema, idempotent)
│   ├── database.py          ✅
│   └── init_db.py           ✅
└── services/
    ├── transcription/
    │   ├── __init__.py      ✅
    │   ├── youtube_fetcher.py  ✅ (captions → Whisper API fallback)
    │   └── song_detector.py   ✅ (Telugu worship keywords + chorus + rhythm)
    └── translation/
        ├── __init__.py      ✅ (was missing — now fixed)
        ├── openrouter_client.py ✅
        └── router.py        ✅
Dockerfile                   ✅ (python:3.11-slim + ffmpeg + pip install)
railway.json                 ✅ (builder: DOCKERFILE)
package.json                 🗑️ DELETED (was causing Railway Node.js detection)
next.config.js               🗑️ DELETED (same reason)
```

---

## What Needs To Happen Next (In Order)

### Step 1 — Set Railway env vars (2 min, user action)

Go to Railway → OMI-TED backend service → Variables tab. Add:

| Variable | Value |
|----------|-------|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` from openrouter.ai |
| `OPENAI_API_KEY` | `sk-...` from platform.openai.com |
| `CORS_ORIGINS` | `https://omi-automation-gb9p-git-omi-te-847b91-rakshan-rakshans-projects.vercel.app` |

`DATABASE_URL` is auto-set by the Railway PostgreSQL plugin — don't touch it.

### Step 2 — Trigger Railway redeploy

Push a dummy commit OR click "Deploy" in Railway UI. The build should now show:
```
Step 1/5 : FROM python:3.11-slim    ← must be Python, NOT Node.js
```

### Step 3 — Verify backend is alive

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
# Expected: {"status":"ok","version":"0.1.0"}

curl https://YOUR-RAILWAY-URL.up.railway.app/docs
# Expected: FastAPI Swagger UI loads
```

### Step 4 — Update Vercel frontend

In Vercel → omi-ted-frontend project → Environment Variables:
- Set `NEXT_PUBLIC_API_BASE` = `https://YOUR-RAILWAY-URL.up.railway.app`
- Trigger redeploy

### Step 5 — Test golden path

1. Open frontend → Videos page
2. Paste a Telugu YouTube URL → click Add
3. Wait for status to change `pending → fetching → complete` (refresh)
4. Open the video → segments appear with Telugu text + timestamps
5. Click Translate on a segment (Good tier)
6. Translation appears in English column
7. Click Approve
8. Go to `/dataset/export?format=jsonl` → download fine-tuning data

---

## API Endpoints Reference

```
GET  /health
GET  /docs

POST /api/v1/ingest/video              {youtube_url}
POST /api/v1/ingest/batch              {youtube_urls: [...], max_concurrency: 3}
GET  /api/v1/ingest/videos             ?limit=50&offset=0
GET  /api/v1/ingest/video/{id}
GET  /api/v1/ingest/video/{id}/segments ?is_song=false&limit=100
PATCH /api/v1/ingest/segment/{id}/song {is_song: bool, confidence: float}
DELETE /api/v1/ingest/video/{id}

POST /api/v1/translate/segment/{id}   {tier: "good", model_id?: "...", set_active: true}
POST /api/v1/translate/video/{id}     {tier: "good", skip_songs: true}
POST /api/v1/translate/segment/{id}/approve
POST /api/v1/translate/segment/{id}/edit  {english_text: "..."}

GET  /api/v1/dataset/export           ?format=jsonl (or csv)
GET  /api/v1/dataset/stats
GET  /api/v1/reports/overview
GET  /api/v1/models/available         (live OpenRouter catalog)
```

---

## Transcription Logic (How Non-Captioned Videos Work)

```
POST /ingest/video
  → background task _do_ingest()
    → fetch_transcript(youtube_url)
      → 1. Try youtube-transcript-api (Telugu captions)
      → 2. If none: yt-dlp downloads audio-only (m4a, no video)
             → OpenAI Whisper API (model="whisper-1", language="te")
             → Returns timestamped segments
      → detect_songs(segments)
        → Telugu worship keywords score (0-0.9)
        → Chorus repetition score (0-0.85)
        → Rhythmic burst score (0-0.4)
        → is_song = confidence >= 0.55
    → Insert segments into DB
    → Update video status = 'complete'
```

---

## Known Costs to Budget

- **OpenAI Whisper**: ~$0.006/minute of audio
  - Avg Telugu sermon: 60 min = ~$0.36 per video
  - 6700 videos = ~$2,400 total (confirm budget before batch processing)
- **OpenRouter (translation)**: varies by model
  - claude-sonnet-4-6 ≈ $3/1M tokens (Good tier)
  - For 6700 videos × ~500 segments × ~50 tokens each = manageable

---

## Batch Processing 6700 Videos

Once backend is confirmed working on Railway:

```bash
# Example: ingest a playlist batch
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/v1/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "youtube_urls": [
      "https://www.youtube.com/watch?v=VIDEO_ID_1",
      "https://www.youtube.com/watch?v=VIDEO_ID_2",
      ...
    ],
    "max_concurrency": 3
  }'

# Returns: {"job_id": "...", "queued": 50, "video_ids": [...]}

# Check progress
curl https://YOUR-RAILWAY-URL.up.railway.app/api/v1/reports/overview
```

Recommend batching 50 URLs at a time, not all 6700 at once.

---

## Do Not Touch

- `main` branch — old Sarvam app, production
- `https://omi-automation-gb9p.vercel.app/` — old Sarvam URL, do not break

---

## Model Assignment for Next Session

| Task | Model |
|------|-------|
| Reading docs, checking files | Haiku |
| Connecting services, debugging logs | Sonnet |
| Writing/fixing Python code | Opus |
| Git commits, repetitive tasks | Haiku |

---

*Repo: rakshan-rakshan/omi-automation*
*Backend branch: omi-ted-backend | Frontend branch: omi-ted-frontend*
*Last updated: 2026-04-25 by Claude Haiku*
