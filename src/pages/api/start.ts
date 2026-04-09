import type { NextApiRequest, NextApiResponse } from 'next';
import { startApifyRun } from '@/lib/apify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { youtubeUrl } = req.body;
  if (!youtubeUrl) return res.status(400).json({ error: 'youtubeUrl required' });

  try {
    const apifyRunId = await startApifyRun(youtubeUrl);
    return res.status(200).json({ apifyRunId });
  } catch (e: any) {
    console.error('start error:', e.response?.data || e.message);
    return res.status(500).json({ error: e.message });
  }
}
