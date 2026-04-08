import type { NextApiRequest, NextApiResponse } from 'next';
import { sarvamCompletePipeline } from '@/lib/sarvam';

type ResponseData = {
  success: boolean;
  data?: {
    teluguTranscript: string;
    englishTranscript: string;
    audioUrl: string;
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

  const { youtubeUrl, audioUrl } = req.body;

  if (!youtubeUrl && !audioUrl) {
    return res.status(400).json({ success: false, error: 'YouTube URL or audio URL required' });
  }

  try {
    console.log('🎯 MODE 3: FULL DUB (COMPLETE PIPELINE)');

    // Use provided audio URL or YouTube URL
    const url = audioUrl || youtubeUrl;

    // Complete Sarvam pipeline (STT + NMT + TTS)
    console.log('🔄 Running complete pipeline (STT → NMT → TTS)...');
    const pipelineResult = await sarvamCompletePipeline(url);
    console.log('✅ Pipeline complete');

    // Return complete results with audio data
    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: pipelineResult.teluguText,
        englishTranscript: pipelineResult.englishText,
        audioUrl: pipelineResult.audioUrl,
        duration: 0,
      },
    });
  } catch (error: any) {
    console.error('Full dub error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Dubbing failed',
    });
  }
}
