import type { NextApiRequest, NextApiResponse } from 'next';
import { initBatchJob, uploadAudioBuffer, startBatchJob } from '@/lib/sarvamBatch';

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const buffer = await readRawBody(req);
    if (!buffer.length) return res.status(400).json({ error: 'No file data received' });

    const contentType = (req.headers['content-type'] as string)?.split(';')[0] || 'audio/mpeg';
    const ext = contentType.includes('mp4') ? 'mp4'
      : contentType.includes('webm') ? 'webm'
      : contentType.includes('ogg') ? 'ogg'
      : contentType.includes('wav') ? 'wav'
      : 'mp3';

    const { jobId, inputStoragePath, outputStoragePath } = await initBatchJob();
    await uploadAudioBuffer(inputStoragePath, buffer, `audio.${ext}`, contentType);
    await startBatchJob(jobId);

    return res.status(200).json({ sarvamJobId: jobId, outputStoragePath });
  } catch (e: any) {
    const detail = e.response?.data ? JSON.stringify(e.response.data) : '';
    console.error('upload-start error:', e.message, detail);
    return res.status(500).json({ error: `[upload-start] ${e.message}${detail ? ' — ' + detail : ''}` });
  }
}
