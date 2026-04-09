import type { NextApiRequest, NextApiResponse } from 'next';
import { getYoutubeDownloadUrl } from '@/lib/cobalt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { youtubeUrl } = req.body;
  if (!youtubeUrl) return res.status(400).json({ error: 'youtubeUrl required' });

  try {
    const result = await getYoutubeDownloadUrl(youtubeUrl);
    // Return audioUrl + videoUrl directly — no async run needed
    return res.status(200).json(result);
  } catch (e: any) {
    const detail = e.response?.data ? JSON.stringify(e.response.data) : '';
    console.error('download error:', e.message, detail);
    return res.status(500).json({ error: `[download] ${e.message}${detail ? ' — ' + detail : ''}` });
  }
}
