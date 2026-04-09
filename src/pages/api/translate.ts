import type { NextApiRequest, NextApiResponse } from 'next';
import { downloadYouTubeAudio } from '@/lib/youtube';
import { sarvamSTTandTranslate } from '@/lib/sarvam';

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
    return res.status(400).json({ success: false, error: 'youtubeUrl is required' });
  }

  try {
    console.log('MODE 2: TRANSLATE —', youtubeUrl);

    const { buffer, contentType } = await downloadYouTubeAudio(youtubeUrl);
    console.log(`Audio downloaded: ${buffer.length} bytes`);

    const { teluguText, englishText } = await sarvamSTTandTranslate(buffer, contentType);
    console.log('Transcription + translation complete');

    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: teluguText,
        englishTranscript: englishText,
        duration: 0,
      },
    });
  } catch (error: any) {
    console.error('Translate error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Translation failed',
    });
  }
}
