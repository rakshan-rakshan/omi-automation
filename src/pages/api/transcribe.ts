import type { NextApiRequest, NextApiResponse } from 'next';
import { downloadYouTubeAudio, cleanupAudioFile } from '@/lib/youtube';
import { sarvamSTT } from '@/lib/sarvam';
import fs from 'fs';

type ResponseData = {
  success: boolean;
  data?: {
    teluguTranscript: string;
    duration: number;
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { youtubeUrl } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ success: false, error: 'YouTube URL required' });
  }

  let audioPath: string | null = null;

  try {
    console.log('🎯 MODE 1: TRANSCRIBE ONLY');

    // Step 1: Download audio from YouTube
    console.log('📥 Step 1: Downloading audio...');
    const downloadResult = await downloadYouTubeAudio(youtubeUrl, 'mp3');
    audioPath = downloadResult.audioPath;
    console.log('✅ Downloaded to:', audioPath);

    // Step 2: Convert local file to URL for Sarvam API
    // Note: In production, upload to S3/CDN for public URL
    const audioUrl = fs.existsSync(audioPath)
      ? `file://${audioPath}` // Local fallback
      : `http://localhost:3000/api/audio/${encodeURIComponent(audioPath)}`;

    // Step 3: Transcribe using Sarvam STT
    console.log('🎤 Step 2: Transcribing (STT)...');
    const sttResult = await sarvamSTT(audioUrl);
    console.log('✅ Transcription complete');

    // Return results
    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: sttResult.transcript,
        duration: downloadResult.duration,
      },
    });
  } catch (error: any) {
    console.error('Transcribe error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed',
    });
  } finally {
    // Cleanup audio file
    if (audioPath) {
      await cleanupAudioFile(audioPath);
    }
  }
}
