# OMI Automation API Documentation

## Overview

Complete API for YouTube to English translation and dubbing pipeline using Sarvam AI.

**Base URL:** `https://your-vercel-app.vercel.app`

---

## Endpoints

### 1. POST /api/transcribe

Transcribe Telugu audio from YouTube to English text.

**Mode 1: Transcribe Only**

#### Request

```http
POST /api/transcribe HTTP/1.1
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "teluguTranscript": "నమస్కారం ఆండీ...",
    "duration": 245
  }
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": "Failed to download audio: Invalid URL"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| youtubeUrl | string | Yes | Valid YouTube URL |

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Request success status |
| data.teluguTranscript | string | Transcribed Telugu audio |
| data.duration | number | Audio duration in seconds |
| error | string | Error message (if failed) |

#### Example Usage

```javascript
const response = await fetch('https://your-app.vercel.app/api/transcribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
});

const result = await response.json();
console.log(result.data.teluguTranscript);
```

#### Cost

- **Sarvam STT:** ~₹2-3 per 10-minute video (~$0.03)

#### Processing Time

- Download: 10-30 seconds
- Transcription: 30-60 seconds
- **Total:** 40-90 seconds

---

### 2. POST /api/translate

Transcribe and translate Telugu audio to English.

**Mode 2: Translate (Bilingual)**

#### Request

```http
POST /api/translate HTTP/1.1
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "teluguTranscript": "నమస్కారం ఆండీ...",
    "englishTranscript": "Greetings everyone...",
    "duration": 245
  }
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": "NMT failed: Translation service unavailable"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| youtubeUrl | string | Yes | Valid YouTube URL |

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Request success status |
| data.teluguTranscript | string | Original Telugu transcription |
| data.englishTranscript | string | Translated English transcription |
| data.duration | number | Audio duration in seconds |
| error | string | Error message (if failed) |

#### Example Usage

```javascript
const response = await fetch('https://your-app.vercel.app/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
});

const { data } = await response.json();
console.log('Telugu:', data.teluguTranscript);
console.log('English:', data.englishTranscript);
```

#### Cost

- **Sarvam STT:** ~₹2-3 per 10-minute video
- **Sarvam NMT:** ~₹2-3 per 10-minute video
- **Total:** ~₹4-6 (~$0.06)

#### Processing Time

- Download: 10-30 seconds
- Transcription: 30-60 seconds
- Translation: 20-40 seconds
- **Total:** 60-130 seconds

---

### 3. POST /api/dub

Complete pipeline: download, transcribe, translate, and generate dubbed audio.

**Mode 3: Full Dub**

#### Request

```http
POST /api/dub HTTP/1.1
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "outputFormat": "mp4"
}
```

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "videoUrl": "/api/download?file=omi-dubbed-1712667000000.mp4",
    "teluguTranscript": "నమస్కారం ఆండీ...",
    "englishTranscript": "Greetings everyone...",
    "duration": 245,
    "fileSize": 52428800
  }
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": "TTS failed: Audio generation service unavailable"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| youtubeUrl | string | Yes | Valid YouTube URL |
| outputFormat | string | No | Output format: mp4, mkv, webm (default: mp4) |

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Request success status |
| data.videoUrl | string | Download URL for dubbed video |
| data.teluguTranscript | string | Original Telugu transcription |
| data.englishTranscript | string | Translated English transcription |
| data.duration | number | Video duration in seconds |
| data.fileSize | number | Output file size in bytes |
| error | string | Error message (if failed) |

#### Example Usage

```javascript
const response = await fetch('https://your-app.vercel.app/api/dub', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    outputFormat: 'mp4'
  })
});

const { data } = await response.json();
console.log('Video ready:', data.videoUrl);
console.log('File size:', (data.fileSize / 1024 / 1024).toFixed(2), 'MB');

// Download
window.location.href = data.videoUrl;
```

#### Cost

- **Sarvam STT:** ~₹2-3 per 10-minute video
- **Sarvam NMT:** ~₹2-3 per 10-minute video
- **Sarvam TTS:** ~₹3-4 per 10-minute video
- **Total:** ~₹7-10 (~$0.10)

#### Processing Time

- Download: 10-30 seconds
- Transcription: 30-60 seconds
- Translation: 20-40 seconds
- TTS (audio generation): 60-120 seconds
- Video merge: 30-90 seconds
- **Total:** 2-5 minutes

#### Output Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| mp4 | .mp4 | Most compatible, H.264 video, AAC audio |
| mkv | .mkv | Matroska container, supports multiple audio tracks |
| webm | .webm | Web format, VP8/VP9 video |

---

### 4. GET /api/download

Download generated video files.

#### Request

```http
GET /api/download?file=omi-dubbed-1712667000000.mp4 HTTP/1.1
```

#### Response

File download with appropriate Content-Type and Content-Disposition headers.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | Filename (from dub response) |

#### Example Usage

```javascript
// From /api/dub response
const downloadUrl = data.videoUrl; // "/api/download?file=..."
window.location.href = downloadUrl;

// Or in fetch
const response = await fetch(downloadUrl);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'dubbed-video.mp4';
a.click();
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid YouTube URL | Malformed URL | Check URL format |
| Failed to download audio | Network issue | Retry or check video availability |
| STT failed | Sarvam API error | Check API key, retry |
| NMT failed | Translation service down | Retry in a few minutes |
| TTS failed | Audio generation failed | Retry or contact Sarvam |
| Video not found | File doesn't exist | Check filename from response |

---

## Rate Limiting

Currently no rate limiting. For production with 6,600+ videos:

**Recommendations:**
- Queue requests (50-100 at a time)
- Process during off-peak hours
- Monitor Sarvam API limits
- Implement exponential backoff for retries

---

## Batch Processing

For processing multiple videos:

```javascript
const videos = [
  'https://www.youtube.com/watch?v=...',
  'https://www.youtube.com/watch?v=...',
  // ... more URLs
];

async function processBatch(urls, batchSize = 5) {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    const promises = batch.map(url =>
      fetch('/api/dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url })
      }).then(r => r.json())
    );
    
    const results = await Promise.all(promises);
    console.log('Batch complete:', results);
    
    // Add delay between batches
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

processBatch(videos);
```

---

## Environment Variables

Required in Vercel:

```
SARVAM_API_KEY=your_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

---

## Testing

### Using cURL

```bash
curl -X POST https://your-app.vercel.app/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

### Using Postman

1. Create new POST request
2. URL: `https://your-app.vercel.app/api/transcribe`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   }
   ```
5. Send

---

## Support

For issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Review Sarvam API docs: https://www.sarvam.ai
4. Check YouTube URL is valid and public
