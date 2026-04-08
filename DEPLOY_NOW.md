# 🎬 OMI Automation - DEPLOY NOW

## ⚡ Quick Deploy (Choose One)

### 1️⃣ PowerShell (Windows) - Easiest
```powershell
cd C:\Users\Rakshan\Projects\omi-automation
.\deploy.ps1
```

### 2️⃣ Command Line
```bash
cd /path/to/omi-automation
git push -u origin main
```

### 3️⃣ Web Dashboard
Open `deploy.html` in your browser

---

## What Happens Next

1. Code pushes to GitHub
2. You go to https://vercel.com/new
3. Import the `omi-automation` repo
4. Add 3 environment variables (from your .env.local)
5. Click Deploy
6. **LIVE in ~2 minutes** 🎉

---

## Environment Variables (For Vercel)

Paste these into Vercel dashboard:

```
SARVAM_API_KEY = <from your .env.local>
SUPABASE_URL = https://whkmjcngyijxwuiors.supabase.co
SUPABASE_ANON_KEY = <from your .env.local>
```

---

## Test Your App

Once deployed:
1. Open your Vercel URL
2. Select Mode 1: Transcribe
3. Paste a YouTube URL
4. Click Process
5. Should see Telugu transcript in ~1 minute

---

## Documentation

- 📖 **Full Guide:** `SETUP.md`
- 🔌 **API Docs:** `API.md`  
- ⚡ **Quick Ref:** `QUICKSTART.md`
- 📊 **Status:** `STATUS.md`

---

## You're 100% Ready

All code is built and committed.

**Next: Run deploy script and you're live!**
