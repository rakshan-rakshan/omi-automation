/**
 * YouTube audio URL resolver using play-dl.
 * Calls YouTube's internal API directly — no third-party instances required.
 */
import playdl from 'play-dl';

export interface DownloadResult {
  audioUrl: string;
  videoUrl: string;
  title: string;
}

export async function getYoutubeDownloadUrl(youtubeUrl: string): Promise<DownloadResult> {
  const info = await playdl.video_basic_info(youtubeUrl);
  const details = info.video_details;

  // Pick highest-bitrate audio-only format
  const audioFormats = (info.format as any[])
    .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  if (!audioFormats.length) {
    throw new Error('No audio formats found for this video');
  }

  return {
    audioUrl: audioFormats[0].url,
    videoUrl: details.url ?? youtubeUrl,
    title: details.title ?? '',
  };
}
