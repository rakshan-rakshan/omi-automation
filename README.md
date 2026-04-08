# OMI Automation - YouTube to English Dubbing Pipeline

Complete pipeline for translating and dubbing Telugu YouTube videos to English using Sarvam AI.

## Features

- **Mode 1: Transcribe** - Download audio, transcribe Telugu to English text
- **Mode 2: Translate** - Bilingual transcripts (Telugu + English)
- **Mode 3: Full Dub** - Complete English dubbed MP4 with dual audio tracks

## Pipeline

1. **Download** - Extract audio from YouTube using yt-dlp
2. **Transcribe** - Convert Telugu audio to English text using Sarvam STT
3. **Translate** - Translate text using Sarvam NMT
4. **Dub** - Generate English audio using Sarvam TTS
5. **Merge** - Combine audio tracks with original video using FFmpeg

## Environment Variables

Required in Vercel dashboard:
- `SARVAM_API_KEY` - Your Sarvam AI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

## API Endpoints

### POST /api/transcribe
Download YouTube audio and transcribe to English text.

**Request:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "language": "te" // Telugu
}
```

### POST /api/translate
Translate text to English with Telugu transcript.

**Request:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "text": "Telugu text here"
}
```

### POST /api/dub
Complete pipeline: download → transcribe → translate → dub → merge video.

**Request:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "outputFormat": "mp4" // mp4, mkv, webm
}
```

## Deployment

Deployed on Vercel with real Sarvam AI integration. No local installation required.

Visit: https://omi-automation-gb9p.vercel.app
