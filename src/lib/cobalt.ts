/**
 * cobalt.tools — open-source YouTube/audio download API
 * POST https://api.cobalt.tools/
 * Docs: https://github.com/imputnet/cobalt
 */
import axios from 'axios';

export interface DownloadResult {
  audioUrl: string;
  videoUrl: string;
}

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  // Optional: set COBALT_API_KEY env var for higher rate limits
  if (process.env.COBALT_API_KEY) {
    headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;
  }

  const res = await axios.post(
    'https://api.cobalt.tools/',
    { url: youtubeUrl, downloadMode: 'audio', audioFormat: 'mp3' },
    { headers }
  );

  const { status, url } = res.data;

  if (status === 'error') {
    throw new Error(`cobalt error: ${res.data.error?.code ?? JSON.stringify(res.data.error)}`);
  }

  if (!url) {
    throw new Error(`cobalt returned status "${status}" but no URL`);
  }

  return { audioUrl: url, videoUrl: url };
}
