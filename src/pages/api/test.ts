/**
 * GET /api/test
 * Health-checks env vars and reachability of cobalt + Sarvam APIs.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {};

  results['SARVAM_API_KEY'] = process.env.SARVAM_API_KEY ? 'set' : 'MISSING';

  // --- cobalt.tools: resolve a known short video ---
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (process.env.COBALT_API_KEY) headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;

    const r = await axios.post(
      'https://api.cobalt.tools/',
      { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', downloadMode: 'audio', audioFormat: 'mp3' },
      { headers }
    );
    const { status, url } = r.data;
    results['cobalt'] = status === 'error'
      ? `ERROR: ${r.data.error?.code}`
      : `OK — status: ${status}, url: ${url ? 'present' : 'MISSING'}`;
  } catch (e: any) {
    results['cobalt'] = `ERROR ${e.response?.status}: ${JSON.stringify(e.response?.data || e.message)}`;
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
