import type { NextApiRequest, NextApiResponse } from 'next';
import { getBatchJobResults } from '@/lib/sarvamBatch';
import { sarvamTTS } from '@/lib/sarvam';
import { buildSRT } from '@/lib/srt';

// Sarvam TTS max ~2500 chars per call; chunk longer text
function chunkText(text: string, maxLen = 2400): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('. ', maxLen);
    if (cut === -1) cut = maxLen;
    else cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { sarvamJobId, outputStoragePath, videoUrl } = req.body;
  if (!sarvamJobId || !outputStoragePath) {
    return res.status(400).json({ error: 'sarvamJobId and outputStoragePath required' });
  }

  try {
    // 1. Download STTT results (English transcript + timestamps) from Azure
    const segments = await getBatchJobResults(sarvamJobId, outputStoragePath);
    console.log(`Got ${segments.length} transcript segments`);

    // 2. Build English SRT from segments
    const englishSrt = buildSRT(segments);

    // 3. TTS: generate English dubbed audio from full transcript
    const fullText = segments.map((s) => s.text).join(' ');
    const textChunks = chunkText(fullText);
    const audioParts: string[] = [];
    for (const chunk of textChunks) {
      if (!chunk.trim()) continue;
      const ttsResult = await sarvamTTS(chunk, 'en-IN');
      audioParts.push(ttsResult.audioData);
    }
    // Use first chunk's audio (for multi-chunk videos, only first segment plays)
    // Full time-aligned dubbing requires ffmpeg which isn't available on Vercel
    const englishAudioBase64 = audioParts[0] || '';

    return res.status(200).json({
      englishSrt,
      englishAudioBase64,
      videoUrl: videoUrl || null,
      segmentCount: segments.length,
    });
  } catch (e: any) {
    const detail = e.response?.data ? JSON.stringify(e.response.data) : '';
    console.error('finalize error:', e.message, detail);
    return res.status(500).json({ error: `[finalize] ${e.message}${detail ? ' — ' + detail : ''}` });
  }
}
