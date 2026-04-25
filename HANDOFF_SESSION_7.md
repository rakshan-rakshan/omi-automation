# OMI-TED Session 7 Handoff

**Date**: 2026-04-25  
**Session 7 Status**: Two critical fixes pushed — awaiting Railway & Vercel redeploy  
**Backend branch**: `omi-ted-backend` (Railway)  
**Frontend branch**: `claude/debug-backend-issues-DZMtf` (Vercel)  
**Backend URL**: https://omi-automation-production.up.railway.app

---

## What Happened in Session 7

### Problem Inherited From Session 6
The user was getting a **Network Error** on every API call from the frontend. Two causes were identified at the end of Session 6:
1. **CORS**: Browser was calling Railway directly; Railway rejected cross-origin requests
2. **Railway backend DOWN**: Health check failure — `1/1 replicas never became healthy! Healthcheck failed!`

### Fix 1 — Frontend: Next.js Proxy Rewrites (CORS eliminated permanently)
**Branch**: `claude/debug-backend-issues-DZMtf`  
**Commit**: `06cc17c`

Changed the architecture so the browser **never calls Railway directly**:

**`next.config.js`** — Added server-side proxy rewrites:
```js
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE || '';
  if (!backendUrl) return [];
  return [{ source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` }];
},
```

**`lib/api.ts`** — Client always uses relative path:
```ts
const client = axios.create({ baseURL: '/api/v1' });
```

**How it works now**:
```
Browser → /api/v1/ingest/videos (same Vercel domain, no CORS)
              ↓  [Vercel server rewrites]
         https://railway-url.up.railway.app/api/v1/ingest/videos
```
CORS is architecturally eliminated. `CORS_ORIGINS` on Railway no longer matters for the frontend.

### Fix 2 — Backend: Health Check Timeout + PYTHONPATH
**Branch**: `omi-ted-backend`  
**Commit**: `b290853`

**`railway.json`** — Doubled health check timeout:
```json
"healthcheckTimeout": 60  // was 30
```
Heavy Python deps (yt-dlp, sacrebleu, nltk, google-generativeai) cause slow cold-starts that were racing the 30s window.

**`nixpacks.toml`** — Added PYTHONPATH as safety net:
```toml
[variables]
PYTHONPATH = "."
```
If Railway uses nixpacks instead of Dockerfile, the `backend.*` module path will resolve.

---

## Current Architecture

```
Browser
  │  HTTP requests to SAME ORIGIN (no CORS)
  ▼
Vercel (Next.js)  ← branch: claude/debug-backend-issues-DZMtf
  │  server-side proxy rewrite via next.config.js rewrites()
  │  NEXT_PUBLIC_API_BASE env var controls destination
  ▼
Railway FastAPI  ← branch: omi-ted-backend
  │
  ├── PostgreSQL (Railway managed DB)
  └── OpenRouter (LLM translation API)
```

---

## Environment Variables

### Vercel — must be set
```
NEXT_PUBLIC_API_BASE=https://omi-automation-production.up.railway.app
```
This is now used **server-side only** by the rewrite rule. It is NOT baked into client JS.

### Railway — should already be set from Session 5
```
DATABASE_URL=postgresql+asyncpg://...
OPENROUTER_API_KEY=sk-or-...
CORS_ORIGINS=*               ← doesn't matter anymore (proxy bypasses CORS)
HOST=0.0.0.0
PORT=                        ← Railway sets this automatically
DEBUG=false
```

---

## Action Required on Your End

### 1. Verify Railway redeploys successfully
Railway auto-redeploys on push to `omi-ted-backend`. Check Railway dashboard:
- Build should succeed (Dockerfile)
- Health check should pass within 60s
- Logs should show: `"App is now ready to serve requests"`

```bash
curl https://omi-automation-production.up.railway.app/health
# Expected: {"status":"ok","version":"0.1.0"}
```

### 2. Verify Vercel redeploys successfully
Vercel auto-redeploys on push to `claude/debug-backend-issues-DZMtf`. In Vercel dashboard:
- Build should pass
- Check that `NEXT_PUBLIC_API_BASE` is set to the Railway URL

### 3. Test the golden path
```
1. Open frontend Vercel URL
2. /videos → click "Add Videos"
3. Paste a Telugu YouTube URL → Submit
4. Video should appear with status "fetching" → eventually "complete"
5. Click "Edit →"
6. In the editor, click "Translate All" → select "Good" tier
7. Review segments → Approve or edit
8. /dataset → "Check row count" → "Download JSONL"
```

---

## If Something Still Fails

### If Railway health check STILL fails after redeploy
The Dockerfile is the primary builder. If the Docker build passes but startup still fails:
1. Check Railway logs for Python import errors (`ModuleNotFoundError`)
2. Check if `PORT` env var is set (Railway sets it; should be fine)
3. Try redeploying manually from Railway dashboard
4. As a last resort: in Railway Variables, set `DEBUG=true` for verbose logs

### If frontend still shows errors after Vercel redeploys
1. In browser DevTools → Network tab → find a failing `/api/v1/*` request
2. If status is **502/503**: Railway backend is down (check Railway logs)
3. If status is **404**: Vercel rewrite isn't firing — check `NEXT_PUBLIC_API_BASE` is set in Vercel Variables and NOT empty
4. If status is **CORS error**: This should be impossible now (requests go through Vercel), but if it appears, clear browser cache and reload

### If Vercel shows "NEXT_PUBLIC_API_BASE is empty / rewrites() returns []"
The rewrite rule returns `[]` if `NEXT_PUBLIC_API_BASE` is empty. Go to:
Vercel Dashboard → Project → Settings → Environment Variables → confirm `NEXT_PUBLIC_API_BASE` is set to `https://omi-automation-production.up.railway.app` → trigger a redeploy.

---

## Branch / File Summary

| Branch | Deploy Target | Last Commit |
|--------|--------------|-------------|
| `claude/debug-backend-issues-DZMtf` | Vercel | `06cc17c` — proxy rewrites |
| `omi-ted-backend` | Railway | `b290853` — 60s health check |

### Files changed in Session 7

**Frontend** (`claude/debug-backend-issues-DZMtf`):
```
next.config.js    — added async rewrites() proxy rule
lib/api.ts        — client baseURL always '/api/v1' (relative)
```

**Backend** (`omi-ted-backend`):
```
railway.json      — healthcheckTimeout: 30 → 60
nixpacks.toml     — added [variables] PYTHONPATH = "."
```

---

## Known Remaining Work (not blocking, lower priority)

1. **`/api/v1/reports/model-costs`** — reports page calls this, endpoint may not exist on backend. Page uses `Promise.allSettled` so it silently fails. Add endpoint to backend if cost reporting is needed.
2. **`/api/v1/models/migrate`** — models page has a migrate button that hits this. Backend may not have this route. Shows an error alert if clicked.
3. **Editor segment limit** — editor fetches max 500 segments (`limit: 500`). Long videos (>500 segments) will be truncated. Add pagination if needed.
4. **Batch translate long videos** — translate endpoint runs in background on Railway. Very long videos (1000+ segments) may time out on Railway's free tier.

---

## Repo Context

- `omi-ted-frontend` branch — original frontend code (has bugs, don't deploy this)
- `omi-ted-backend` branch — Python FastAPI backend code (deployed to Railway)
- `claude/debug-backend-issues-DZMtf` — frontend with all Session 6+7 fixes (deployed to Vercel)
- `main` branch — old Sarvam pipeline (completely different project, ignore)

---

*Prepared: 2026-04-25 | Session 7*
