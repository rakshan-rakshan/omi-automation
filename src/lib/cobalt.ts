/**
 * YouTube audio URL resolver using YouTube's Innertube API (Android client).
 * The Android client context returns direct audio URLs (no cipher) and is
 * not subject to the bot-verification blocks that hit web scraper clients.
 * No third-party instances or extra packages required — only axios.
 */
import axios from 'axios';

// Public Innertube key embedded in YouTube's own web/app clients
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

function extractVideoId(url: string): string {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  throw new Error('Could not extract YouTube video ID from: ' + url);
}

export interface DownloadResult {
  audioUrl: string;
  videoUrl: string;
  title: string;
}

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const videoId = extractVideoId(youtubeUrl);

  const res = await axios.post(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
    {
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '17.31.35',
          androidSdkVersion: 30,
          userAgent: 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
          hl: 'en',
          gl: 'US',
        },
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '17.31.35',
      },
      timeout: 15000,
    }
  );

  const playability = res.data.playabilityStatus;
  if (playability?.status !== 'OK') {
    throw new Error(`Video unavailable: ${playability?.reason ?? playability?.status}`);
  }

  const formats: any[] = res.data.streamingData?.adaptiveFormats ?? [];
  const audioFormats = formats
    .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  if (!audioFormats.length) {
    throw new Error('No audio formats found for this video');
  }

  return {
    audioUrl: audioFormats[0].url,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: res.data.videoDetails?.title ?? '',
  };
}
