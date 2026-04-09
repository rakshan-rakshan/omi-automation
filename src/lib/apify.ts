import axios from 'axios';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
// Default actor: tazy~youtube-converter returns separate audioUrl + videoUrl
// Apify actor IDs use '~' separator (e.g. tazy~youtube-converter).
// Normalize in case the env var was set with '/' (tazy/youtube-converter).
const APIFY_ACTOR_ID = (process.env.APIFY_ACTOR_ID || 'tazy~youtube-converter').replace('/', '~');

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
    { videoUrl: youtubeUrl, format: 'mp3', cookiesText: process.env.YOUTUBE_COOKIES_TEXT || '' },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const runId: string = res.data.data.id;
  console.log(`Apify run started: ${runId}`);
  return runId;
}

/** Poll a run. Returns status + result URLs when SUCCEEDED. */
export async function getApifyRunStatus(runId: string): Promise<{
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';
  result?: ApifyResult;
}> {
  const runRes = await axios.get(
    `${BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
  );
  const status = runRes.data.data.status;

  if (status !== 'SUCCEEDED') return { status };

  // Fetch dataset items to get download URLs
  const dataRes = await axios.get(
    `${BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
  );
  const items: any[] = dataRes.data;
  if (!items.length) throw new Error('Apify run succeeded but dataset is empty');

  const item = items[0];
  return {
    status,
    result: {
      audioUrl: item.downloadUrl || item.audioUrl || item.url,
      videoUrl: item.videoUrl || item.downloadUrl || item.url,
      title: item.title || '',
    },
  };
}
