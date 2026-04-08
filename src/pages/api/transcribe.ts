import type { NextApiRequest, NextApiResponse } from 'next';
import { sarvamSTT } from '@/lib/sarvam';

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

  const { youtubeUrl, audioUrl } = req.body;

  if (!youtubeUrl && !audioUrl) {
    return res.status(400).json({ success: false, error: 'YouTube URL or audio URL required' });
  }

  try {
    console.log('🎯 MODE 1: TRANSCRIBE');

    // Use provided audio URL or YouTube URL
    const url = audioUrl || youtubeUrl;

    // Transcribe using Sarvam STT
    console.log('🎤 Transcribing (STT)...');
    const sttResult = await sarvamSTT(url);
    console.log('✅ Transcription complete');

    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: sttResult.transcript,
        duration: sttResult.duration,
      },
    });
  } catch (error: any) {
    console.error('Transcribe error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed',
    });
  }
}
