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
 * Pick the best available audio format with multiple fallbacks.
 * ytdl.chooseFormat can throw "Failed to find any playable formats" when
 * the requested quality tier doesn't exist — this avoids that.
 */
function pickAudioFormat(formats: ytdl.videoFormat[]): ytdl.videoFormat {
  const withAudio = formats.filter((f) => f.hasAudio);

  if (withAudio.length === 0) {
    throw new Error('No audio formats available for this video');
  }

  // Prefer audio-only (smaller download), sorted by bitrate ascending
  const audioOnly = withAudio
    .filter((f) => !f.hasVideo)
    .sort((a, b) => (a.audioBitrate ?? 999) - (b.audioBitrate ?? 999));

  if (audioOnly.length > 0) return audioOnly[0];

  // Fall back to muxed stream with lowest bitrate
  return withAudio.sort((a, b) => (a.audioBitrate ?? 999) - (b.audioBitrate ?? 999))[0];
}

/**
 * Download audio from a YouTube URL into an in-memory Buffer.
 * Uses @distube/ytdl-core — pure JS, no system binaries required.
 */
export async function downloadYouTubeAudio(url: string): Promise<AudioDownloadResult> {
  const agent = buildAgent();

  const info = await ytdl.getInfo(url, agent ? { agent } : undefined);
  const videoId = info.videoDetails.videoId;

  console.log(`Video: ${info.videoDetails.title} (${videoId})`);
  console.log(`Available formats: ${info.formats.length}`);

  const format = pickAudioFormat(info.formats);
  console.log(`Selected format: ${format.mimeType} ${format.audioBitrate}kbps`);

  const stream = ytdl.downloadFromInfo(info, { format, agent: agent ?? undefined });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  console.log(`Downloaded ${buffer.length} bytes`);

  const contentType = format.mimeType?.split(';')[0] || 'audio/webm';

  return { buffer, contentType, videoId };
}
