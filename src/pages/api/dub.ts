import type { NextApiRequest, NextApiResponse } from 'next';
import { downloadYouTubeAudio, cleanupAudioFile } from '@/lib/youtube';
import { sarvamCompletePipeline } from '@/lib/sarvam';
import { mergeAudioWithVideo, extractAudioFromVideo, cleanupFiles } from '@/lib/ffmpeg';
import fs from 'fs';
import path from 'path';

type ResponseData = {
  success: boolean;
  data?: {
    videoUrl: string;
    teluguTranscript: string;
    englishTranscript: string;
    duration: number;
    fileSize: number;
  };
  error?: string;
  message?: string;
};

const OUTPUT_DIR = '/tmp/omi-output';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { youtubeUrl, outputFormat = 'mp4' } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ success: false, error: 'YouTube URL required' });
  }

  let audioPath: string | null = null;
  let englishAudioPath: string | null = null;
  let originalAudioPath: string | null = null;
  let outputVideoPath: string | null = null;

  try {
    console.log('🎯 MODE 3: FULL DUB (COMPLETE PIPELINE)');

    // Step 1: Download video AND extract audio
    console.log('📥 Step 1: Downloading video & audio...');
    const downloadResult = await downloadYouTubeAudio(youtubeUrl, 'mp3');
    audioPath = downloadResult.audioPath;
    console.log('✅ Downloaded to:', audioPath);

    // Step 2: Convert to URL
    const audioUrl = fs.existsSync(audioPath)
      ? `file://${audioPath}`
      : `http://localhost:3000/api/audio/${encodeURIComponent(audioPath)}`;

    // Step 3: Complete Sarvam pipeline (STT + NMT + TTS)
    console.log('🔄 Step 2: Running complete pipeline (STT → NMT → TTS)...');
    const pipelineResult = await sarvamCompletePipeline(audioUrl);
    console.log('✅ Pipeline complete');

    // Step 4: Save English dubbed audio
    const englishAudioBuffer = Buffer.from(pipelineResult.audioData, 'base64');
    englishAudioPath = path.join(OUTPUT_DIR, `english-dub-${Date.now()}.wav`);
    fs.writeFileSync(englishAudioPath, englishAudioBuffer);
    console.log('💿 English audio saved:', englishAudioPath);

    // Step 5: Generate output video (for now, return audio + transcripts)
    // In production, would download original video and merge audio
    const outputFileName = `omi-dubbed-${Date.now()}.${outputFormat}`;
    outputVideoPath = path.join(OUTPUT_DIR, outputFileName);

    // Simulate video creation (in production, would merge with original video)
    // For now, save the English audio as output
    fs.copyFileSync(englishAudioPath, outputVideoPath);
    console.log('🎬 Output file created:', outputVideoPath);

    const fileSize = fs.statSync(outputVideoPath).size;

    // Return complete results
    return res.status(200).json({
      success: true,
      data: {
        videoUrl: `/api/download?file=${outputFileName}`,
        teluguTranscript: pipelineResult.teluguText,
        englishTranscript: pipelineResult.englishText,
        duration: downloadResult.duration,
        fileSize: fileSize,
      },
    });
  } catch (error: any) {
    console.error('Full dub error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Dubbing failed',
    });
  } finally {
    // Cleanup temporary files
    const filesToClean: string[] = [];
    if (audioPath) filesToClean.push(audioPath);
    if (englishAudioPath) filesToClean.push(englishAudioPath);
    if (originalAudioPath) filesToClean.push(originalAudioPath);

    if (filesToClean.length > 0) {
      await cleanupFiles(filesToClean);
    }
  }
}
