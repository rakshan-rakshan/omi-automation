/**
 * GET /api/test
 * Health-checks env vars and reachability of Apify + Sarvam APIs.
 * Use this to diagnose 404/401 errors before running the full pipeline.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const results: Record<string, string> = {};

  // --- Env vars ---
  results['APIFY_API_TOKEN'] = process.env.APIFY_API_TOKEN ? 'set' : 'MISSING';
  results['SARVAM_API_KEY'] = process.env.SARVAM_API_KEY ? 'set' : 'MISSING';

  const actorId = (process.env.APIFY_ACTOR_ID || 'frederikhbb~youtube-downloader').replace('/', '~');
  results['APIFY_ACTOR_ID'] = actorId;

  // --- Apify: check actor exists + fetch input schema ---
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      results['apify_actor'] = 'SKIP (no token)';
    } else {
      const r = await axios.get(`https://api.apify.com/v2/acts/${actorId}?token=${token}`);
      const actor = r.data.data;
      results['apify_actor'] = `OK — ${actor.name || actorId}`;

      // Show the required input fields so we can confirm the schema
      try {
        const schema = actor.versions?.[0]?.inputSchema;
        if (schema) {
          const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
          const required: string[] = parsed.required ?? [];
          const fields = Object.keys(parsed.properties ?? {});
          results['apify_actor_schema'] = `required: [${required.join(', ')}] / all: [${fields.join(', ')}]`;
        } else {
          results['apify_actor_schema'] = 'not available in actor metadata';
        }
      } catch {
        results['apify_actor_schema'] = 'could not parse schema';
      }
    }
  } catch (e: any) {
    results['apify_actor'] = `ERROR ${e.response?.status}: ${JSON.stringify(e.response?.data || e.message)}`;
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
        { inputs: ['test'], target_language_code: 'en-IN', speaker: 'shruti', model: 'bulbul:v2' },
        { headers: { 'api-subscription-key': key } }
      );
      results['sarvam_tts'] = `OK — ${r.data.audios?.length ?? 0} audio(s) returned`;
    }
  } catch (e: any) {
    results['sarvam_tts'] = `ERROR ${e.response?.status}: ${JSON.stringify(e.response?.data || e.message)}`;
  }

  return res.status(200).json(results);
}
