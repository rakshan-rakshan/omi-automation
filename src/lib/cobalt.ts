/**
 * YouTube audio URL resolver — tries multiple public Piped/Invidious instances.
 * Strategy:
 *   1. Race all hardcoded Piped instances in parallel (first success wins)
 *   2. Race all hardcoded Invidious instances in parallel
 *   3. Fetch live instance lists and race up to 8 of them
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
  'https://pipedapi.adminforge.de',
  'https://pipedapi.ducks.party',
  'https://api.piped.yt',
  'https://piped.smnz.de',
  'https://pipedapi.reallyaweso.me',
];

// Invidious instances — returns { adaptiveFormats: [{ type, url, bitrate }] }
const INVIDIOUS = [
  'https://yewtu.be',
  'https://invidious.privacydev.net',
  'https://iv.datura.network',
  'https://invidious.nerdvpn.de',
  'https://invidious.fdn.fr',
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

/** Fetch the live list of Piped API instances from the project registry. */
async function fetchLivePipedInstances(): Promise<string[]> {
  const res = await axios.get('https://instances.piped.video/', { timeout: 6000 });
  return (res.data as any[]).map((i: any) => i.api_url).filter(Boolean);
}

/** Fetch the live list of Invidious instances from the project registry. */
async function fetchLiveInvidiousInstances(): Promise<string[]> {
  const res = await axios.get('https://api.invidious.io/instances.json', { timeout: 6000 });
  return (res.data as any[])
    .filter((i: any) => i[1]?.api !== false && i[1]?.type === 'https')
    .map((i: any) => `https://${i[0]}`);
}

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const videoId = extractVideoId(youtubeUrl);

  // Round 1: race all hardcoded Piped instances (parallel)
  try {
    return await Promise.any(PIPED.map((base) => tryPiped(base, videoId)));
  } catch {}

  // Round 2: race all hardcoded Invidious instances (parallel)
  try {
    return await Promise.any(INVIDIOUS.map((base) => tryInvidious(base, videoId)));
  } catch {}

  // Round 3: fetch live instance lists, race up to 8 of each
  const [livePipedResult, liveInvidiousResult] = await Promise.allSettled([
    fetchLivePipedInstances(),
    fetchLiveInvidiousInstances(),
  ]);
  const livePiped = livePipedResult.status === 'fulfilled'
    ? livePipedResult.value.filter((u) => !PIPED.includes(u)).slice(0, 8)
    : [];
  const liveInvidious = liveInvidiousResult.status === 'fulfilled'
    ? liveInvidiousResult.value.filter((u) => !INVIDIOUS.includes(u)).slice(0, 8)
    : [];

  const liveAttempts = [
    ...livePiped.map((base) => tryPiped(base, videoId)),
    ...liveInvidious.map((base) => tryInvidious(base, videoId)),
  ];
  if (liveAttempts.length > 0) {
    try {
      return await Promise.any(liveAttempts);
    } catch {}
  }

  throw new Error('[download] All YouTube instances failed — try again in a moment.');
}
