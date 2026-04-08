# 🎬 OMI Automation - Quick Reference

## ✅ What Was Built

### Backend API Endpoints
- **POST /api/transcribe** - Download + STT (Telugu → English text)
- **POST /api/translate** - Download + STT + NMT (bilingual transcript)
- **POST /api/dub** - Full pipeline (STT → NMT → TTS → dubbed video)
- **GET /api/download** - Download generated videos

### Integrations
- ✅ Sarvam AI (STT, NMT, TTS)
- ✅ yt-dlp (YouTube audio download)
- ✅ FFmpeg (audio/video merge)
- ✅ Supabase (optional storage)

### Frontend
- ✅ Mode selection UI (3 processing modes)
- ✅ URL input form
- ✅ Results display (transcripts + download)
- ✅ Error handling
- ✅ Responsive design (Tailwind CSS)

### Configuration
- ✅ TypeScript setup
- ✅ Next.js app configuration
- ✅ Environment variables template
- ✅ Vercel deployment config
- ✅ Git commits ready

---

## 🚀 Next Steps (DO THIS NOW)

### Option 1: PowerShell (Easiest - Windows)
```powershell
cd C:\Users\Rakshan\Projects\omi-automation
.\deploy.ps1
```

### Option 2: Manual Push
```bash
cd /path/to/omi-automation
git push -u origin main
```

### Option 3: Web Dashboard
Open `deploy.html` in browser

---

## 🔐 Vercel Setup

After pushing to GitHub:

1. Go to https://vercel.com/new
2. Import `omi-automation` repo
3. Add 3 environment variables:
   - `SARVAM_API_KEY` (from .env.local)
   - `SUPABASE_URL` (from .env.local)
   - `SUPABASE_ANON_KEY` (from .env.local)
4. Click Deploy
5. Wait 1-2 minutes

---

## 📊 Processing Modes

| Mode | Input | Output | Cost | Time |
|------|-------|--------|------|------|
| **1: Transcribe** | YouTube URL | Telugu text | ₹2-3 | 1-2 min |
| **2: Translate** | YouTube URL | Telugu + English text | ₹4-6 | 2-3 min |
| **3: Full Dub** | YouTube URL | MP4 with English audio | ₹7-10 | 3-5 min |

---

## 💰 Scaling Cost

For 6,600 videos (10 min each):
- Total API cost: ~$660-800
- Vercel hosting: Free tier + small compute
- **Total:** ~$700-900 one-time

Per video cost: ~$0.10

---

## 📁 File Structure

```
src/
├── pages/          (Frontend pages + API endpoints)
│   ├── api/        (4 API endpoints)
│   └── index.tsx   (Main UI)
├── lib/            (Core libraries)
│   ├── sarvam.ts   (AI integration - 178 lines)
│   ├── youtube.ts  (Download - 120 lines)
│   └── ffmpeg.ts   (Video merge - 145 lines)
└── components/     (React components)
    ├── Layout.tsx
    ├── ModeCard.tsx
    └── Results.tsx
```

---

## 🔑 API Examples

### Transcribe
```javascript
fetch('/api/transcribe', {
  method: 'POST',
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=...'
  })
}).then(r => r.json()).then(d => console.log(d.data.teluguTranscript))
```

### Translate
```javascript
fetch('/api/translate', {
  method: 'POST',
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=...'
  })
}).then(r => r.json()).then(d => {
  console.log('Telugu:', d.data.teluguTranscript)
  console.log('English:', d.data.englishTranscript)
})
```

### Full Dub
```javascript
fetch('/api/dub', {
  method: 'POST',
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=...',
    outputFormat: 'mp4'
  })
}).then(r => r.json()).then(d => {
  window.location.href = d.data.videoUrl // Download
})
```

---

## 🔍 Verify Deployment

1. **Frontend loads:** Go to your Vercel URL, see mode selection
2. **Mode 1 works:** Input URL → get Telugu transcript
3. **Mode 2 works:** Input URL → get bilingual transcript
4. **Mode 3 works:** Input URL → get downloadable audio

---

## 🐛 Troubleshooting

**Push fails?**
- Get GitHub token: https://github.com/settings/tokens
- Use: `node push.js <token>`

**Vercel build fails?**
- Check env vars are set (all 3)
- Check Vercel logs for error

**API returns error?**
- Verify SARVAM_API_KEY is correct
- Check YouTube URL is valid
- Try different video

---

## 📞 Important Files

| File | Purpose |
|------|---------|
| `SETUP.md` | Detailed deployment guide |
| `API.md` | Complete API documentation |
| `README.md` | Project overview |
| `deploy.ps1` | PowerShell deploy script |
| `deploy.html` | Web deployment interface |

---

## ✨ You're Ready!

All code is built, committed, and ready to deploy.

**Time to live:** ~2 minutes after GitHub push + Vercel setup

**Questions?** Check `SETUP.md` or `API.md`
