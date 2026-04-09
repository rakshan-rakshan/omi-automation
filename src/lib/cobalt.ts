/**
 * YouTube audio URL resolver — tries multiple public Piped/Invidious instances.
 * No auth, no sign-up. Falls back through the list until one works.
 */
import axios from 'axios';

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

// Piped instances — returns { audioStreams: [{ url, bitrate }] }
const PIPED = [
  'https://pipedapi.moomoo.me',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.kavin.rocks',
];

// Invidious instances — returns { adaptiveFormats: [{ type, url, bitrate }] }
const INVIDIOUS = [
  'https://inv.riverside.rocks',
  'https://invidious.snopyta.org',
  'https://yt.artemislena.eu',
  'https://invidious.io',
];

async function tryPiped(base: string, videoId: string): Promise<DownloadResult> {
  const res = await axios.get(`${base}/streams/${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  const streams: any[] = res.data.audioStreams ?? [];
  if (!streams.length) throw new Error('no audio streams');
  streams.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return { audioUrl: streams[0].url, videoUrl: res.data.hls ?? streams[0].url, title: res.data.title ?? '' };
}

async function tryInvidious(base: string, videoId: string): Promise<DownloadResult> {
  const res = await axios.get(`${base}/api/v1/videos/${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  const formats: any[] = (res.data.adaptiveFormats ?? []).filter(
    (f: any) => (f.type as string).startsWith('audio/')
  );
  if (!formats.length) throw new Error('no audio formats');
  formats.sort((a, b) => parseInt(b.bitrate ?? '0') - parseInt(a.bitrate ?? '0'));
  return { audioUrl: formats[0].url, videoUrl: formats[0].url, title: res.data.title ?? '' };
}

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const videoId = extractVideoId(youtubeUrl);
  const errors: string[] = [];

  for (const base of PIPED) {
    try { return await tryPiped(base, videoId); } catch (e: any) { errors.push(`piped ${base}: ${e.message}`); }
  }
  for (const base of INVIDIOUS) {
    try { return await tryInvidious(base, videoId); } catch (e: any) { errors.push(`invidious ${base}: ${e.message}`); }
  }

  throw new Error(`All instances failed:\n${errors.join('\n')}`);
}
