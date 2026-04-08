# OMI Automation - Deployment Instructions

## Option 1: Automatic Push (Recommended)

Since the code is already committed and ready, use this bash command to push to GitHub:

```bash
cd /home/claude/omi-automation
git branch -M main
git push -u origin main
```

**If you get an authentication error**, you need a GitHub Personal Access Token. Here's how:

### Step 1: Get GitHub Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all), `workflow`
4. Copy the token
5. Run:
```bash
git config --global credential.helper store
echo "https://YOUR_GITHUB_USERNAME:YOUR_TOKEN@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials
```

Then try the push again.

---

## Option 2: Manual GitHub Push via Vercel

1. Create GitHub repo: https://github.com/new
   - Name: `omi-automation`
   - Public or Private (your choice)
   - **Do NOT initialize** with README

2. In Vercel Dashboard:
   - https://vercel.com/new
   - Select **Import Git Repository**
   - Connect your GitHub account
   - Import the `omi-automation` repo

3. In Vercel Project Settings, add Environment Variables:
   - `SARVAM_API_KEY` = Your Sarvam API key
   - `SUPABASE_URL` = Your Supabase URL
   - `SUPABASE_ANON_KEY` = Your Supabase anon key

4. Click **Deploy** - Vercel will auto-build and deploy

---

## Environment Variables Needed in Vercel

Your existing credentials from .env.local:

```
SARVAM_API_KEY=your_sarvam_key_here
SUPABASE_URL=https://whkmjcngyijxwuiors.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Project Structure

```
omi-automation/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   ├── transcribe.ts    (Mode 1: Download + STT)
│   │   │   ├── translate.ts     (Mode 2: Download + STT + NMT)
│   │   │   ├── dub.ts          (Mode 3: Full pipeline + TTS)
│   │   │   └── download.ts     (File download handler)
│   │   ├── _app.tsx            (App wrapper)
│   │   └── index.tsx           (Main UI)
│   ├── lib/
│   │   ├── sarvam.ts           (STT, NMT, TTS APIs)
│   │   ├── youtube.ts          (yt-dlp download)
│   │   └── ffmpeg.ts           (Audio/video merge)
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── ModeCard.tsx
│   │   └── Results.tsx
│   └── styles/
│       └── globals.css
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── vercel.json
└── README.md
```

---

## API Endpoints

### POST /api/transcribe
**Mode 1: Transcribe Only**
- Downloads YouTube audio
- Converts to English text (Sarvam STT)
- Returns: `{teluguTranscript, duration}`

### POST /api/translate
**Mode 2: Translate (Bilingual)**
- Downloads YouTube audio
- Transcribes + translates
- Returns: `{teluguTranscript, englishTranscript, duration}`

### POST /api/dub
**Mode 3: Full Dub**
- Downloads audio
- STT (Telugu → English text)
- NMT (text translation)
- TTS (English audio generation)
- Returns: `{teluguTranscript, englishTranscript, videoUrl, duration, fileSize}`

---

## Deployment Status

✅ All code committed and ready to push
✅ All API endpoints integrated with Sarvam AI
✅ Frontend UI complete with 3 modes
✅ Vercel config ready
✅ Environment variables template provided

**Next Step:** Push to GitHub and connect to Vercel
