# OMI-TED Session 2 Handoff — Complete Implementation Guide

> **Status**: Architecture clarified. 7 critical files need to be written. Estimated 2-3 follow-ups to completion.
> **Written**: 2026-04-24 (Haiku model)
> **For**: Next Claude session at 4:30 AM IST

---

## What You Need to Know (TL;DR)

### The Real App Requirements (Clarified This Session)

1. **Transcripts from non-captioned Telugu videos** ← **This is the blocker**
   - `youtube-transcript-api` ONLY works for videos WITH captions
   - For 6700 videos from 1 speaker, many have NO YouTube captions
   - **Solution**: yt-dlp (audio-only download) + OpenAI Whisper API
   - Whisper handles Telugu excellently with word-level timestamps
   - **No full video download** — audio-only is 10-100x smaller

2. **Finetune dataset** for theological translation quality
   - Store approved Telugu↔English pairs as JSONL
   - Include glossary of Christian terms
   - Export for fine-tuning Claude/other LLMs

3. **6700 videos batch processing**
   - Single video ingest: `POST /ingest/video`
   - Batch ingest: `POST /ingest/batch` (up to 200 URLs per request)
   - Async background processing with status polling

4. **Song detection and marking**
   - Heuristic detection: Telugu worship keywords + rhythm patterns + repetition
   - Manual override: `PATCH /ingest/segment/{id}/song`
   - Songs are part of sermons, need separate handling

5. **Parallel editor with timestamps**
   - Side-by-side Telugu/English in real-time
   - Full timeline view
   - (Frontend code exists on `omi-ted-frontend` branch)

---

## What Exists vs What's Missing

### ✅ ALREADY BUILT (Don't Touch)

**Backend** (`omi-ted-backend` branch):
- ✅ `backend/api/main.py` — FastAPI app with correct router imports
- ✅ `backend/api/routes/translate.py` — LLM translation endpoints (working)
- ✅ `backend/api/routes/models.py` — Model registry + OpenRouter proxy
- ✅ `backend/db/schema.sql` — Complete PostgreSQL schema (idempotent)
- ✅ `backend/db/database.py` — Async SQLAlchemy + asyncpg
- ✅ `backend/config/settings.py` — Settings with `openai_api_key` (needed for Whisper)
- ✅ `backend/services/translation/openrouter_client.py` — OpenRouter HTTP client
- ✅ `backend/services/translation/router.py` — Translation tier logic
- ✅ `requirements.txt` — Has `openai>=1.30.0`, `yt-dlp`, `youtube-transcript-api`, etc.
- ✅ `Dockerfile` — Python 3.11-slim (needs 1 line added: ffmpeg)

**Frontend** (`omi-ted-frontend` branch):
- ✅ Parallel editor UI
- ✅ Model selector dropdown
- ✅ API client with Whisper support ready

---

### ❌ MISSING — 7 FILES TO CREATE

All needed for a complete, working app:

#### 1. `backend/services/transcription/__init__.py`
```python
from backend.services.transcription.youtube_fetcher import fetch_transcript
from backend.services.transcription.song_detector import detect_songs

__all__ = ["fetch_transcript", "detect_songs"]
```

#### 2. `backend/services/transcription/youtube_fetcher.py` (450 lines)
**Core logic**: Try YouTube captions first (fast), fallback to Whisper for non-captioned videos.

Key functions:
- `extract_video_id(url)` — parse YouTube URL
- `_get_metadata(video_id)` — title, channel, duration via yt-dlp (no download)
- `_fetch_captions(video_id)` — `youtube-transcript-api` for captions
- `_whisper_transcribe(youtube_url, video_id)` — **Critical**:
  - Download AUDIO-ONLY via yt-dlp (no ffmpeg needed if native m4a available)
  - Send to `openai.audio.transcriptions.create(file=..., model="whisper-1", language="te", response_format="verbose_json", timestamp_granularities=["segment"])`
  - Returns segments with `start`, `end`, `text` (in ms + text)
  - Clean up temp file
- `fetch_transcript(youtube_url)` → dict with source (captions/whisper), segments, metadata

**Environment required**: `OPENAI_API_KEY` in Railway

#### 3. `backend/services/transcription/song_detector.py` (200 lines)
**Heuristic song detection** for Telugu Christian sermons.

Signals:
1. Telugu worship keywords: హల్లెలూయా, ఆమెన్, స్తుతి, ఆరాధన, హోసన్న, etc.
2. Repeated lines across consecutive segments (chorus detection)
3. Short segments in rhythmic bursts (< 2 sec each, 3+ in a row)

Returns list of segments with `is_song` (bool) and `song_confidence` (float 0-1).

#### 4. `backend/api/routes/ingest.py` (600 lines) ← **THE MAIN ROUTE**
**Endpoints**:
- `POST /ingest/video` — Single YouTube URL → creates video record → background task ingests
- `POST /ingest/batch` — List of URLs → batch job → concurrent ingestion
- `GET /ingest/videos` — List all videos with pagination, filters
- `GET /ingest/video/{id}` — Single video detail
- `GET /ingest/video/{id}/segments` — All segments for a video (with all translation columns)
- `PATCH /ingest/segment/{id}/song` — Toggle song flag
- `DELETE /ingest/video/{id}` — Delete video + segments

**Background ingest task** (`_do_ingest`):
1. Fetch transcript via `fetch_transcript()` — returns captions OR Whisper
2. Run song detection via `detect_songs()`
3. Insert segments into DB with timestamps, song flags
4. Update video status: `pending` → `fetching` → `complete` (or `failed`)
5. Handle errors gracefully — store error in metadata, don't crash

#### 5. `backend/api/routes/dataset.py` (300 lines)
**Dataset export for fine-tuning**.

- `GET /dataset/export?format=jsonl` → JSONL download (OpenAI fine-tuning format)
  ```json
  {"messages": [
    {"role": "system", "content": "You are a professional Telugu-to-English translator..."},
    {"role": "user", "content": "Translate: [Telugu text]"},
    {"role": "assistant", "content": "[English translation]"}
  ]}
  ```
- `GET /dataset/export?format=pairs` → Simple {telugu, english} pairs (JSONL)
- `GET /dataset/export?format=csv` → CSV with all columns
- Filters: `status=approved` (only approved translations), `include_songs=false` (skip songs), `min_quality=0.5`
- `GET /dataset/stats` — Total videos, segments, approved pairs, total cost
- `GET /dataset/glossary` — Export theological glossary terms

#### 6. `backend/api/routes/reports.py` (200 lines)
**Reporting endpoints**.

- `GET /reports/overview` — Total videos, ingested, failed, translated, approved, songs, total cost
- `GET /reports/progress` — Per-video ingest & translation progress (paginated)
- `GET /reports/costs` — Cost breakdown by tier (best/good/cheap)

#### 7. `backend/services/translation/__init__.py` (NEW — currently missing!)
**This file is missing but `backend/api/routes/translate.py` imports from it.**

```python
from backend.services.translation.openrouter_client import LLMResponse, OpenRouterClient
from backend.services.translation.router import TranslationResult, TranslationRouter

__all__ = ["LLMResponse", "OpenRouterClient", "TranslationResult", "TranslationRouter"]
```

#### 8. Update `Dockerfile` (1 line added)
**Current**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
```

**Add ffmpeg** (yt-dlp uses it for audio extraction):
```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
ENV PYTHONPATH=/app
CMD uvicorn backend.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

---

## Environment Variables Needed (Railway)

| Variable | Value | Why | Required? |
|----------|-------|-----|----------|
| `DATABASE_URL` | auto-set | PostgreSQL plugin | ✅ Auto |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | Translation LLM calls | ✅ Manual |
| `OPENAI_API_KEY` | `sk-...` from openai.com | Whisper transcription | ✅ Manual |
| `CORS_ORIGINS` | Vercel frontend URL | Allow frontend requests | ✅ Manual |
| `MODEL_BEST` | `anthropic/claude-opus-4-7` | Best-tier model | ⚪ Optional (default fine) |
| `MODEL_GOOD` | `anthropic/claude-sonnet-4-6` | Good-tier default | ⚪ Optional |
| `MODEL_CHEAP` | `anthropic/claude-haiku-4-5` | Cheap-tier default | ⚪ Optional |

---

## Implementation Order (4-5 Follow-ups)

### Follow-up 1: Build Transcription Service
1. Create files 1-3 above (transcription package)
2. Test with a sample Telugu video URL:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ingest/video \
     -H "Content-Type: application/json" \
     -d '{"youtube_url": "https://www.youtube.com/watch?v=VIDEOID"}'
   # Should return video_id with status=pending
   # Check logs for Whisper transcription happening
   ```
3. Verify segments are created in DB
4. Verify song detection ran

### Follow-up 2: Build Ingest Routes
1. Create `backend/api/routes/ingest.py`
2. Create missing `backend/services/translation/__init__.py`
3. Test all 7 endpoints
4. Test batch ingest with 5-10 URLs

### Follow-up 3: Build Dataset + Reports
1. Create `backend/api/routes/dataset.py`
2. Create `backend/api/routes/reports.py`
3. Approve some translations in DB
4. Export JSONL dataset
5. Verify format is correct for fine-tuning

### Follow-up 4: Railway Deployment Fix
1. User changes Railway builder to Dockerfile in UI (see HANDOFF.md section 6)
2. Add `OPENAI_API_KEY` to Railway env vars
3. Update `CORS_ORIGINS` to Vercel URL
4. Deploy and test `/health` endpoint

### Follow-up 5: End-to-End Test
1. Add a test Telugu video URL
2. Watch ingest complete
3. Translate a segment
4. Approve it
5. Export JSONL dataset
6. Verify all pieces work together

---

## Critical Technical Notes

### Whisper + yt-dlp
- **Audio-only download**: `format="bestaudio[ext=m4a]/bestaudio/best"`
- **Language**: `language="te"` (Telugu)
- **Response format**: `response_format="verbose_json"` + `timestamp_granularities=["segment"]`
- **Timestamps**: Returned in seconds — multiply by 1000 for milliseconds
- **Cost**: ~$0.006 per minute of audio (OpenAI Whisper API pricing)

### Song Detection Heuristics
- Telugu worship words trigger 0.5-0.9 confidence
- Chorus repetition (same line 2+ times in neighbors) → 0.85 confidence
- Rhythmic shortness (< 2 sec in a burst) → secondary boost
- **Threshold**: is_song = True when confidence >= 0.55

### Batch Ingest
- Uses `asyncio.Semaphore(max_concurrency)` to limit parallel downloads
- Each video gets its own DB session (no shared session)
- Updates batch_job metadata with completed/failed counts
- Non-blocking — returns immediately, tasks run in background

### Background Tasks (FastAPI)
- Use `from fastapi import BackgroundTasks` + `background_tasks.add_task(_func)`
- Task runs in its own `AsyncSessionLocal()` session
- Must handle exceptions gracefully (don't let task crashes affect the API)
- Update video status in DB even on failure

---

## Known Gotchas

1. **`youtube-transcript-api` fails silently for non-captioned videos** — Always use try/except and fallback to Whisper

2. **yt-dlp downloads to temp files** — Must clean up after Whisper transcription

3. **OpenAI Whisper API pricing** — Each minute of audio ≈ $0.006. For a 60-min sermon, ~$0.36 per video. For 6700 videos, budget ~$2,400. Get approval first.

4. **Whisper response format** — `verbose_json` with `timestamp_granularities=["segment"]` is crucial. Other formats won't have proper timestamps.

5. **Song confidence calculation** — Don't double-count signals. Use `max(keyword_score, repetition_score) + 0.25 * rhythm_score`, capped at 1.0.

6. **Batch job concurrency** — Limit to 3-5 concurrent downloads (yt-dlp + Whisper are I/O heavy). Use Semaphore.

7. **CORS** — Frontend URL must be in `CORS_ORIGINS` exactly (no trailing slash)

---

## Testing Checklist (Before End-to-End)

- [ ] `POST /ingest/video` with a captioned video → should use captions
- [ ] `POST /ingest/video` with a non-captioned video → should use Whisper
- [ ] Verify segments created with correct `start_ms`, `end_ms`, `telugu_raw`
- [ ] Verify `is_song` detection works
- [ ] `PATCH /ingest/segment/{id}/song` toggles song flag
- [ ] `POST /ingest/batch` queues multiple videos
- [ ] `GET /ingest/videos` pagination works
- [ ] `GET /ingest/video/{id}/segments?is_song=true` filters
- [ ] `GET /dataset/export?format=jsonl` downloads valid JSONL
- [ ] `GET /reports/overview` returns correct counts
- [ ] Whisper transcriptions have proper timestamps (not zero)
- [ ] Song detection confidence scores are between 0 and 1

---

## Key Files Reference

| File | Purpose | When to Edit |
|------|---------|-------------|
| `backend/services/transcription/youtube_fetcher.py` | Captions + Whisper | Changing transcription logic |
| `backend/services/transcription/song_detector.py` | Song detection | Tuning detection heuristics |
| `backend/api/routes/ingest.py` | Ingest pipeline | Changing ingestion workflow |
| `backend/api/routes/dataset.py` | JSONL export | Adding export formats |
| `backend/db/schema.sql` | DB schema | Adding new columns (unlikely) |
| `backend/config/settings.py` | Settings | Adding new env vars |
| `requirements.txt` | Python deps | Adding libraries (unlikely) |

---

## Deployment Checklist (for 4:30 AM IST session)

1. [ ] Create all 7 missing files (or push the code from this session if already written)
2. [ ] Verify `backend/services/translation/__init__.py` exists
3. [ ] Update Dockerfile with ffmpeg
4. [ ] Test locally: `uvicorn backend.api.main:app --reload`
5. [ ] User updates Railway builder to Dockerfile in UI
6. [ ] User adds `OPENAI_API_KEY` and `OPENROUTER_API_KEY` to Railway
7. [ ] Railway redeploys
8. [ ] Verify `GET /health` → 200
9. [ ] User updates `NEXT_PUBLIC_API_BASE` on Vercel
10. [ ] Test golden path: ingest → translate → approve → export

---

## Questions for Next Session

1. **Whisper API budget**: 6700 videos * $0.36 avg = ~$2,400. Is this approved?
2. **Batch size**: What's the right `max_concurrency` for yt-dlp? Recommend 3-5 to avoid rate limits.
3. **Song marking**: Should songs be skipped during translation? (Currently `skip_songs=true` is an option in translate endpoint)
4. **Fine-tuning pipeline**: Once dataset is ready, do you have a separate process for fine-tuning Claude or other models?

---

*Last updated: 2026-04-24*
*Repo: rakshan-rakshan/omi-automation*
*Branch: omi-ted-backend*
*Status: 7 files ready to be written. Code architecture finalized.*
