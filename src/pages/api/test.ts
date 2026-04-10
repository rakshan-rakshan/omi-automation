/**
 * GET /api/test
 * Health-checks Piped + Sarvam APIs.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getYoutubeDownloadUrl } from '@/lib/cobalt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {};

  results['SARVAM_API_KEY'] = process.env.SARVAM_API_KEY ? 'set' : 'MISSING';

  // --- YouTube download: resolve a known short video via full fallback chain ---
  try {
    const dl = await getYoutubeDownloadUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    results['youtube_download'] = `OK — title: "${dl.title}", audioUrl starts with: ${dl.audioUrl.slice(0, 60)}...`;
  } catch (e: any) {
    results['youtube_download'] = `ERROR: ${e.message}`;
  }

  // --- Sarvam: ping STTT batch init ---
  try {
    const key = process.env.SARVAM_API_KEY;
    if (!key) {
      results['sarvam_sttt_batch'] = 'SKIP (no key)';
    } else {
      const r = await axios.post(
        'https://api.sarvam.ai/speech-to-text-translate/job/init',
        {},
        { headers: { 'api-subscription-key': key } }
      );
      results['sarvam_sttt_batch'] = `OK — job_id: ${r.data.job_id}`;
    }
  } catch (e: any) {
    results['sarvam_sttt_batch'] = `ERROR ${e.response?.status}: ${JSON.stringify(e.response?.data || e.message)}`;
  }

  // --- Sarvam: ping TTS ---
  try {
    const key = process.env.SARVAM_API_KEY;
    if (!key) {
      results['sarvam_tts'] = 'SKIP (no key)';
    } else {
      const r = await axios.post(
        'https://api.sarvam.ai/text-to-speech',
        { inputs: ['test'], target_language_code: 'en-IN', speaker: 'anushka', model: 'bulbul:v2' },
        { headers: { 'api-subscription-key': key } }
      );
      results['sarvam_tts'] = `OK — ${r.data.audios?.length ?? 0} audio(s) returned`;
    }
  } catch (e: any) {
    results['sarvam_tts'] = `ERROR ${e.response?.status}: ${JSON.stringify(e.response?.data || e.message)}`;
  }

  return res.status(200).json(results);
}
