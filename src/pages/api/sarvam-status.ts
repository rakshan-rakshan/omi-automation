import type { NextApiRequest, NextApiResponse } from 'next';
import { getBatchJobStatus } from '@/lib/sarvamBatch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  try {
    const status = await getBatchJobStatus(jobId as string);
    return res.status(200).json({ status });
  } catch (e: any) {
    console.error('sarvam-status error:', e.response?.data || e.message);
    return res.status(500).json({ error: e.message });
  }
}
