import ytdl from '@distube/ytdl-core';

interface AudioDownloadResult {
  buffer: Buffer;
  contentType: string;
  videoId: string;
}

/**
 * Download audio from a YouTube URL into an in-memory Buffer.
 * Uses @distube/ytdl-core — pure JS, no system binaries required.
 */
export async function downloadYouTubeAudio(url: string): Promise<AudioDownloadResult> {
  const info = await ytdl.getInfo(url);
  const videoId = info.videoDetails.videoId;

  // Choose lowest-quality audio-only format to minimise buffer size
  const format = ytdl.chooseFormat(info.formats, {
    filter: 'audioonly',
    quality: 'lowestaudio',
  });

  if (!format) {
    throw new Error(`No audio-only format found for video ${videoId}`);
  }

  const stream = ytdl.downloadFromInfo(info, { format });

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
