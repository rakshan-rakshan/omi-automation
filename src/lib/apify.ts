import axios from 'axios';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
// frederikhbb~youtube-downloader: yt-dlp based, stores audio in Apify KV store.
// Input: { startUrls: [{ url }] }  Output dataset item: { url, videoUrl, title }
// Override via APIFY_ACTOR_ID env var. '/' is normalized to '~'.
const APIFY_ACTOR_ID = (process.env.APIFY_ACTOR_ID || 'frederikhbb~youtube-downloader').replace('/', '~');

const BASE = 'https://api.apify.com/v2';

export interface ApifyResult {
  audioUrl: string;
  videoUrl: string;
  title: string;
}

/** Start an Apify actor run asynchronously. Returns the run ID immediately. */
export async function startApifyRun(youtubeUrl: string): Promise<string> {
  const res = await axios.post(
    `${BASE}/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
    // Standard Apify RequestList input — works for most community download actors
    { startUrls: [{ url: youtubeUrl }] },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const runId: string = res.data.data.id;
  console.log(`Apify run started: ${runId} (actor: ${APIFY_ACTOR_ID})`);
  return runId;
}

/** Poll a run. Returns status + result URLs when SUCCEEDED. */
export async function getApifyRunStatus(runId: string): Promise<{
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';
  result?: ApifyResult;
}> {
  const runRes = await axios.get(`${BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
  const status = runRes.data.data.status;

  if (status !== 'SUCCEEDED') return { status };

  const dataRes = await axios.get(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
  );
  const items: any[] = dataRes.data;

  // If dataset is empty, check the default key-value store for the output file
  if (!items.length) {
    const kvUrl = await getKVStoreAudioUrl(runId);
    if (kvUrl) {
      return { status, result: { audioUrl: kvUrl, videoUrl: kvUrl, title: '' } };
    }
    throw new Error('Apify run succeeded but no output found in dataset or KV store');
  }

  const item = items[0];
  console.log('Apify dataset item keys:', Object.keys(item).join(', '));

  // Try all common output field names used by download actors
  const rawUrl: string =
    item.url || item.downloadUrl || item.audioUrl || item.mp3Url || item.fileUrl || '';
  const rawVideoUrl: string =
    item.videoUrl || item.mp4Url || item.downloadUrl || rawUrl;

  const audioUrl = addApifyToken(rawUrl);
  const videoUrl = addApifyToken(rawVideoUrl);

  return {
    status,
    result: { audioUrl, videoUrl, title: item.title || item.videoTitle || '' },
  };
}

/**
 * Some actors store the audio file in the run's default KV store under key "OUTPUT".
 * Try to find an audio URL there.
 */
async function getKVStoreAudioUrl(runId: string): Promise<string | null> {
  try {
    const runRes = await axios.get(`${BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    const storeId: string = runRes.data.data.defaultKeyValueStoreId;
    if (!storeId) return null;

    const keysRes = await axios.get(
      `${BASE}/key-value-stores/${storeId}/keys?token=${APIFY_API_TOKEN}`
    );
    const keys: string[] = (keysRes.data.data?.items ?? []).map((k: any) => k.key);
    console.log('KV store keys:', keys.join(', '));

    // Common output keys used by download actors
    const audioKey = keys.find((k) =>
      ['OUTPUT', 'output', 'audio', 'result'].includes(k) ||
      k.endsWith('.mp3') || k.endsWith('.m4a') || k.endsWith('.wav')
    );
    if (!audioKey) return null;

    const url = `${BASE}/key-value-stores/${storeId}/records/${audioKey}?token=${APIFY_API_TOKEN}`;
    return url;
  } catch {
    return null;
  }
}

/** Append Apify token to api.apify.com URLs; leave external CDN URLs unchanged. */
function addApifyToken(url: string): string {
  if (!url || !url.includes('api.apify.com')) return url;
  return url.includes('?') ? `${url}&token=${APIFY_API_TOKEN}` : `${url}?token=${APIFY_API_TOKEN}`;
}
