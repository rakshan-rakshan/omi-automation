import axios from 'axios';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
// streamers~youtube-video-downloader: startUrls + format input, downloadUrl output, no cookies required.
// Override via APIFY_ACTOR_ID env var. '/' is normalized to '~'.
const APIFY_ACTOR_ID = (process.env.APIFY_ACTOR_ID || 'streamers~youtube-video-downloader').replace('/', '~');

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
    // streamers~youtube-video-downloader schema: videos is a plain string array
    { videos: [youtubeUrl], format: 'm4a' },
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
  if (!items.length) throw new Error('Apify run succeeded but dataset is empty');

  const item = items[0];

  // downloadUrl may be an Apify KV-store URL — append token so Sarvam upload can fetch it
  const rawUrl: string = item.downloadUrl || item.audioUrl || item.url || '';
  const audioUrl = addApifyToken(rawUrl);
  const videoUrl = addApifyToken(item.videoUrl || rawUrl);

  return {
    status,
    result: { audioUrl, videoUrl, title: item.title || '' },
  };
}

/** Append Apify token to api.apify.com URLs; leave external CDN URLs unchanged. */
function addApifyToken(url: string): string {
  if (!url || !url.includes('api.apify.com')) return url;
  return url.includes('?') ? `${url}&token=${APIFY_API_TOKEN}` : `${url}?token=${APIFY_API_TOKEN}`;
}
