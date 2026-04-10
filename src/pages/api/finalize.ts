import type { NextApiRequest, NextApiResponse } from 'next';
import { getBatchJobResults } from '@/lib/sarvamBatch';
import { sarvamTTS } from '@/lib/sarvam';
import { buildSRT } from '@/lib/srt';

/** Find the byte offset where PCM data begins in a WAV buffer. */
function findWavDataOffset(wav: Buffer): number {
  for (let i = 12; i < wav.length - 8; i++) {
    if (wav.toString('ascii', i, i + 4) === 'data') {
      return i + 8; // skip 4-byte marker + 4-byte chunk size
    }
  }
  return 44; // standard PCM offset fallback
}

/**
 * Concatenate multiple same-format WAV buffers into one by
 * copying audio parameters from the first buffer and appending
 * the raw PCM data from all buffers. No ffmpeg required.
 */
function concatenateWavBuffers(wavBuffers: Buffer[]): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];

  const pcmChunks = wavBuffers.map((buf) => buf.slice(findWavDataOffset(buf)));
  const totalPcmSize = pcmChunks.reduce((sum, c) => sum + c.length, 0);

  const first = wavBuffers[0];
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(totalPcmSize + 36, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(first.readUInt16LE(20), 20); // audio format
  header.writeUInt16LE(first.readUInt16LE(22), 22); // num channels
  header.writeUInt32LE(first.readUInt32LE(24), 24); // sample rate
  header.writeUInt32LE(first.readUInt32LE(28), 28); // byte rate
  header.writeUInt16LE(first.readUInt16LE(32), 32); // block align
  header.writeUInt16LE(first.readUInt16LE(34), 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(totalPcmSize, 40);

  return Buffer.concat([header, ...pcmChunks]);
}

// Sarvam TTS hard limit is 500 chars per call; use 490 as safe ceiling
function chunkText(text: string, maxLen = 490): string[] {
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
    const wavBuffers = audioParts.map((b64) => Buffer.from(b64, 'base64'));
    const englishAudioBase64 = wavBuffers.length > 0
      ? concatenateWavBuffers(wavBuffers).toString('base64')
      : '';

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
