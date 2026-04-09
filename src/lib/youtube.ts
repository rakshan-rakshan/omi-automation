import ytdl from '@distube/ytdl-core';

interface AudioDownloadResult {
  buffer: Buffer;
  contentType: string;
  videoId: string;
}

/**
 * Build a ytdl agent from YOUTUBE_COOKIES env var (JSON array of cookie objects).
 * Without cookies, Vercel's datacenter IPs get blocked by YouTube's bot detection.
 *
 * To generate cookies:
 * 1. Install browser extension "Get cookies.txt LOCALLY" (Chrome/Firefox)
 * 2. Open youtube.com while logged in, click the extension → "Export as JSON"
 * 3. Paste the JSON array into Vercel → Settings → Environment Variables
 *    as YOUTUBE_COOKIES
 */
function buildAgent(): ytdl.Agent | undefined {
  const raw = process.env.YOUTUBE_COOKIES;
  if (!raw) return undefined;
  try {
    const cookies: ytdl.Cookie[] = JSON.parse(raw);
    return ytdl.createAgent(cookies);
  } catch {
    console.warn('YOUTUBE_COOKIES is set but could not be parsed as JSON — ignoring');
    return undefined;
  }
}

/**
 * Download audio from a YouTube URL into an in-memory Buffer.
 * Uses @distube/ytdl-core — pure JS, no system binaries required.
 */
export async function downloadYouTubeAudio(url: string): Promise<AudioDownloadResult> {
  const agent = buildAgent();

  const info = await ytdl.getInfo(url, agent ? { agent } : undefined);
  const videoId = info.videoDetails.videoId;

  const format = ytdl.chooseFormat(info.formats, {
    filter: 'audioonly',
    quality: 'lowestaudio',
  });

  if (!format) {
    throw new Error(`No audio-only format found for video ${videoId}`);
  }

  const stream = ytdl.downloadFromInfo(info, { format, agent: agent ?? undefined });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const contentType = format.mimeType?.split(';')[0] || 'audio/webm';

  return {
    buffer: Buffer.concat(chunks),
    contentType,
    videoId,
  };
}
