import type { NextApiRequest, NextApiResponse } from 'next';
import { initBatchJob, streamAudioToAzure, startBatchJob } from '@/lib/sarvamBatch';

const AUDIO_FILENAME = 'audio.mp3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { audioUrl } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });

  try {
    // 1. Create Sarvam STTT batch job → get Azure SAS paths
    const { jobId, inputStoragePath, outputStoragePath } = await initBatchJob();

    // 2. Stream audio from Apify CDN → Azure input blob
    await streamAudioToAzure(inputStoragePath, audioUrl, AUDIO_FILENAME);

    // 3. Trigger Sarvam processing
    await startBatchJob(jobId, 'te-IN');

    return res.status(200).json({ sarvamJobId: jobId, outputStoragePath });
  } catch (e: any) {
    console.error('sarvam-start error:', e.response?.data || e.message);
    return res.status(500).json({ error: e.message });
  }
}
