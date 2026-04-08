import type { NextApiRequest, NextApiResponse } from 'next';
import { downloadYouTubeAudio, cleanupAudioFile } from '@/lib/youtube';
import { sarvamSTTandTranslate } from '@/lib/sarvam';
import fs from 'fs';

type ResponseData = {
  success: boolean;
  data?: {
    teluguTranscript: string;
    englishTranscript: string;
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
    console.log('🎯 MODE 2: TRANSLATE (BILINGUAL)');

    // Step 1: Download audio from YouTube
    console.log('📥 Step 1: Downloading audio...');
    const downloadResult = await downloadYouTubeAudio(youtubeUrl, 'mp3');
    audioPath = downloadResult.audioPath;
    console.log('✅ Downloaded to:', audioPath);

    // Step 2: Convert to URL for API
    const audioUrl = fs.existsSync(audioPath)
      ? `file://${audioPath}`
      : `http://localhost:3000/api/audio/${encodeURIComponent(audioPath)}`;

    // Step 3: Transcribe + Translate
    console.log('🎤 Step 2: Transcribing & Translating...');
    const { teluguText, englishText } = await sarvamSTTandTranslate(audioUrl);
    console.log('✅ Translation complete');

    // Return bilingual results
    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: teluguText,
        englishTranscript: englishText,
        duration: downloadResult.duration,
      },
    });
  } catch (error: any) {
    console.error('Translate error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Translation failed',
    });
  } finally {
    // Cleanup
    if (audioPath) {
      await cleanupAudioFile(audioPath);
    }
  }
}
