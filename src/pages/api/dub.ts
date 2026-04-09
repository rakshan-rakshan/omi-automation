import type { NextApiRequest, NextApiResponse } from 'next';
import { downloadYouTubeAudio } from '@/lib/youtube';
import { sarvamCompletePipeline } from '@/lib/sarvam';

type ResponseData = {
  success: boolean;
  data?: {
    teluguTranscript: string;
    englishTranscript: string;
    audioUrl: string; // data:audio/wav;base64,... — downloadable English WAV
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
    return res.status(400).json({ success: false, error: 'youtubeUrl is required' });
  }

  try {
    console.log('MODE 3: DUB —', youtubeUrl);

    const { buffer, contentType } = await downloadYouTubeAudio(youtubeUrl);
    console.log(`Audio downloaded: ${buffer.length} bytes`);

    const result = await sarvamCompletePipeline(buffer, contentType);
    console.log('Pipeline complete (STT → NMT → TTS)');

    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: result.teluguText,
        englishTranscript: result.englishText,
        audioUrl: result.audioUrl, // base64 WAV data URI
        duration: 0,
      },
    });
  } catch (error: any) {
    console.error('Dub error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Dubbing failed',
    });
  }
}
