/**
 * Piped — open-source YouTube frontend with a public streams API.
 * GET https://pipedapi.kavin.rocks/streams/{videoId}
 * Returns signed YouTube CDN stream URLs. No auth required.
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

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const videoId = extractVideoId(youtubeUrl);

  const res = await axios.get(`https://pipedapi.kavin.rocks/streams/${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const audioStreams: any[] = res.data.audioStreams ?? [];
  if (!audioStreams.length) throw new Error('No audio streams found for this video');

  // Pick highest-bitrate audio stream
  audioStreams.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  const best = audioStreams[0];

  return {
    audioUrl: best.url,
    videoUrl: res.data.hls ?? best.url,
    title: res.data.title ?? '',
  };
}
