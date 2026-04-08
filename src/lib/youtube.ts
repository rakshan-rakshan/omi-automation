import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const DOWNLOADS_DIR = '/tmp/omi-downloads';

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

interface AudioDownloadResult {
  audioPath: string;
  videoTitle: string;
  duration: number;
  format: 'mp3' | 'wav' | 'm4a';
}

/**
 * Download audio from YouTube using yt-dlp
 */
export async function downloadYouTubeAudio(
  youtubeUrl: string,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<AudioDownloadResult> {
  const videoId = extractVideoId(youtubeUrl);
  const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);

  try {
    console.log(`📥 Downloading audio from: ${youtubeUrl}`);

    const audioCodec = format === 'mp3' ? 'libmp3lame' : 'pcm_s16le';
    const command = `yt-dlp \
      --extract-audio \
      --audio-format ${format} \
      --audio-quality 192K \
      --output "${outputPath}" \
      "${youtubeUrl}"`;

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log('✅ Audio downloaded:', stdout);

    // Find the downloaded file
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const audioFile = files.find((f) => f.startsWith(videoId));

    if (!audioFile) {
      throw new Error(`Audio file not found for video ${videoId}`);
    }

    const audioPath = path.join(DOWNLOADS_DIR, audioFile);

    // Get duration using ffprobe
    const duration = await getAudioDuration(audioPath);

    return {
      audioPath,
      videoTitle: videoId,
      duration,
      format,
    };
  } catch (error: any) {
    console.error('YouTube download error:', error.message);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid YouTube URL');
  }
  return match[1];
}

/**
 * Get audio duration using ffprobe
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nokey_prefix=0 "${audioPath}"`;
    const { stdout } = await execAsync(command);
    return parseFloat(stdout.trim());
  } catch (error) {
    console.warn('Could not get audio duration:', error);
    return 0;
  }
}

/**
 * Clean up downloaded files
 */
export async function cleanupAudioFile(audioPath: string): Promise<void> {
  try {
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log('🗑️ Cleaned up:', audioPath);
    }
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
}

/**
 * Convert audio file to public URL for Sarvam API
 */
export function getAudioPublicUrl(audioPath: string): string {
  // In production, upload to CDN or storage
  // For now, return file path (requires special handling in Vercel)
  return `file://${audioPath}`;
}
