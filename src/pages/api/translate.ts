import type { NextApiRequest, NextApiResponse } from 'next';
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

  const { youtubeUrl, audioUrl } = req.body;

  if (!youtubeUrl && !audioUrl) {
    return res.status(400).json({ success: false, error: 'YouTube URL or audio URL required' });
  }

  try {
    console.log('🎯 MODE 2: TRANSLATE (BILINGUAL)');

    // Use provided audio URL or YouTube URL
    const url = audioUrl || youtubeUrl;

    // Transcribe + Translate
    console.log('🎤 Transcribing & Translating...');
    const { teluguText, englishText } = await sarvamSTTandTranslate(url);
    console.log('✅ Translation complete');

    // Return bilingual results
    return res.status(200).json({
      success: true,
      data: {
        teluguTranscript: teluguText,
        englishTranscript: englishText,
        duration: 0,
      },
    });
  } catch (error: any) {
    console.error('Translate error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Translation failed',
    });
  }
}
