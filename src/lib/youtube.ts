import play from 'play-dl';

interface AudioDownloadResult {
  buffer: Buffer;
  contentType: string;
  videoId: string;
}

/**
 * Initialise play-dl with YouTube cookies from YOUTUBE_COOKIES env var.
 * Cookies should be a JSON array exported from the browser (e.g. via
 * "Get cookies.txt LOCALLY" extension set to JSON export).
 */
async function initPlayDl(): Promise<void> {
  const raw = process.env.YOUTUBE_COOKIES;
  if (!raw) return;
  try {
    const cookies: Array<{ name: string; value: string }> = JSON.parse(raw);
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    await play.setToken({ youtube: { cookie: cookieStr } });
  } catch {
    console.warn('YOUTUBE_COOKIES could not be parsed — proceeding without auth');
  }
}

/**
 * Download audio from a YouTube URL into an in-memory Buffer using play-dl.
 */
export async function downloadYouTubeAudio(url: string): Promise<AudioDownloadResult> {
  await initPlayDl();

  // Validate it's a YouTube URL and get the video ID
  const validated = play.yt_validate(url);
  if (validated !== 'video') {
    throw new Error(`Not a valid YouTube video URL: ${url}`);
  }

  const info = await play.video_info(url);
  const videoId = info.video_details.id ?? 'unknown';
  console.log(`Video: ${info.video_details.title} (${videoId})`);

  // stream() returns the audio/video stream; quality 0 = highest, omit for default
  const stream = await play.stream(url, {
    quality: 1, // lowest available (smaller buffer)
  });

  console.log(`Streaming format: ${stream.type}`);

  const chunks: Buffer[] = [];
  for await (const chunk of stream.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  console.log(`Downloaded ${buffer.length} bytes`);

  // play-dl streams are typically webm/opus or mp4/aac
  const contentType = stream.type === 'opus' ? 'audio/webm' : 'audio/mp4';

  return { buffer, contentType, videoId };
}
