import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface AudioMergeOptions {
  videoPath: string;
  englishAudioPath: string;
  teluguAudioPath?: string; // Keep original Telugu audio as second track
  outputPath: string;
  format?: 'mp4' | 'mkv' | 'webm';
}

interface MergeResult {
  outputPath: string;
  success: boolean;
  videoUrl: string;
}

/**
 * Merge audio tracks with video using FFmpeg
 * Creates dual audio track (Telugu original + English dubbed)
 */
export async function mergeAudioWithVideo(options: AudioMergeOptions): Promise<MergeResult> {
  const { videoPath, englishAudioPath, teluguAudioPath, outputPath, format = 'mp4' } = options;

  try {
    console.log('🎬 Merging audio with video...');

    let command: string;

    if (teluguAudioPath) {
      // Dual audio: Keep Telugu original + Add English dubbed
      command = `ffmpeg -i "${videoPath}" \
        -i "${englishAudioPath}" \
        -i "${teluguAudioPath}" \
        -c:v copy \
        -c:a aac \
        -map 0:v:0 \
        -map 1:a:0 \
        -map 2:a:0 \
        -metadata:s:a:0 language=eng -metadata:s:a:0 title="English (Dubbed)" \
        -metadata:s:a:1 language=tel -metadata:s:a:1 title="Telugu (Original)" \
        -y "${outputPath}"`;
    } else {
      // Single audio: Replace with English dubbed audio
      command = `ffmpeg -i "${videoPath}" \
        -i "${englishAudioPath}" \
        -c:v copy \
        -c:a aac \
        -map 0:v:0 \
        -map 1:a:0 \
        -shortest \
        -y "${outputPath}"`;
    }

    console.log('Running FFmpeg merge...');
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large videos
      timeout: 600000, // 10 minute timeout
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg merge failed - output file not created');
    }

    const fileSize = fs.statSync(outputPath).size;
    console.log('✅ Audio merged successfully. Output size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');

    return {
      outputPath,
      success: true,
      videoUrl: `/api/download?file=${path.basename(outputPath)}`,
    };
  } catch (error: any) {
    console.error('FFmpeg merge error:', error.message);
    throw new Error(`Failed to merge audio: ${error.message}`);
  }
}

/**
 * Extract audio from video
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputAudioPath: string,
  format: 'mp3' | 'wav' | 'm4a' = 'wav'
): Promise<string> {
  try {
    const command = `ffmpeg -i "${videoPath}" \
      -q:a 0 \
      -map a \
      -acodec libmp3lame \
      -y "${outputAudioPath}"`;

    console.log('🔊 Extracting audio from video...');
    await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000,
    });

    console.log('✅ Audio extracted:', outputAudioPath);
    return outputAudioPath;
  } catch (error: any) {
    console.error('Audio extraction error:', error.message);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

/**
 * Get video information (duration, codecs, etc.)
 */
export async function getVideoInfo(videoPath: string): Promise<any> {
  try {
    const command = `ffprobe -v error \
      -show_format \
      -show_streams \
      -print_json \
      "${videoPath}"`;

    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  } catch (error: any) {
    console.error('Video info error:', error.message);
    throw new Error(`Failed to get video info: ${error.message}`);
  }
}

/**
 * Cleanup temporary files
 */
export async function cleanupFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Cleaned up:', filePath);
      }
    } catch (error) {
      console.warn('Cleanup error for', filePath, error);
    }
  }
}
