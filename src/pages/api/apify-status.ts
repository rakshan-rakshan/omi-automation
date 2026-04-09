import type { NextApiRequest, NextApiResponse } from 'next';
import { getApifyRunStatus } from '@/lib/apify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: 'runId required' });

  try {
    const result = await getApifyRunStatus(runId as string);
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('apify-status error:', e.response?.data || e.message);
    return res.status(500).json({ error: e.message });
  }
}
