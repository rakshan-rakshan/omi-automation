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
    const detail = e.response?.data ? JSON.stringify(e.response.data) : '';
    console.error('start error:', e.message, detail);
    return res.status(500).json({ error: `[apify-start] ${e.message}${detail ? ' — ' + detail : ''}` });
  }
}
