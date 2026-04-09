/**
 * Sarvam AI Speech-to-Text-Translate (STTT) Batch API
 *
 * Endpoints (from sarvamai/batch-api-typescript):
 *   POST /speech-to-text-translate/job/init  → { jobId, inputStoragePath, outputStoragePath }
 *   PUT  {inputStoragePath}/{filename}        → upload audio to Azure SAS URL
 *   POST /speech-to-text-translate/job        → start job { jobId, language_code }
 *   GET  /speech-to-text-translate/job/{id}/status → { status }
 *   GET  {outputStoragePath}/{filename}.json  → transcript JSON
 *
 * Using STTT (saaras:v3) instead of STT + separate NMT:
 * one API call gives us English transcript with timestamps directly from Telugu audio.
 */

import axios from 'axios';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY!;
const BASE = 'https://api.sarvam.ai';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface BatchJobInit {
  jobId: string;
  inputStoragePath: string;
  outputStoragePath: string;
}

/** Initialise a new STTT batch job. Returns Azure SAS paths for audio upload. */
export async function initBatchJob(): Promise<BatchJobInit> {
  const res = await axios.post(
    `${BASE}/speech-to-text-translate/job/init`,
    {},
    { headers: { 'api-subscription-key': SARVAM_API_KEY } }
  );
  const { jobId, inputStoragePath, outputStoragePath } = res.data;
  console.log(`STTT batch job initialised: ${jobId}`);
  return { jobId, inputStoragePath, outputStoragePath };
}

/**
 * Upload audio bytes to the Azure SAS input path.
 * Constructs: {basePath}/{filename}?{sasToken}
 */
export async function uploadAudioToAzure(
  inputStoragePath: string,
  audioBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  const url = buildAzureBlobUrl(inputStoragePath, filename);
  await axios.put(url, audioBuffer, {
    headers: {
      'Content-Type': contentType,
      'x-ms-blob-type': 'BlockBlob',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  console.log(`Uploaded ${audioBuffer.length} bytes to Azure as ${filename}`);
}

/** Stream-upload audio from a remote URL to Azure SAS path (no full buffer needed). */
export async function streamAudioToAzure(
  inputStoragePath: string,
  audioUrl: string,
  filename: string
): Promise<{ contentType: string }> {
  // Download from Apify CDN as a buffer (audio files are typically 5-30MB)
  const audioRes = await axios.get(audioUrl, {
    responseType: 'arraybuffer',
    maxContentLength: Infinity,
  });
  const buffer = Buffer.from(audioRes.data);
  const contentType: string =
    (audioRes.headers['content-type'] as string)?.split(';')[0] || 'audio/mpeg';

  await uploadAudioToAzure(inputStoragePath, buffer, filename, contentType);
  return { contentType };
}

/** Start the STTT batch job (triggers Sarvam processing). */
export async function startBatchJob(
  jobId: string,
  languageCode: string = 'te-IN'
): Promise<void> {
  await axios.post(
    `${BASE}/speech-to-text-translate/job`,
    { jobId, language_code: languageCode },
    { headers: { 'api-subscription-key': SARVAM_API_KEY } }
  );
  console.log(`STTT batch job started: ${jobId}`);
}

export type BatchStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

/** Poll job status. */
export async function getBatchJobStatus(jobId: string): Promise<BatchStatus> {
  const res = await axios.get(
    `${BASE}/speech-to-text-translate/job/${jobId}/status`,
    { headers: { 'api-subscription-key': SARVAM_API_KEY } }
  );
  return res.data.status as BatchStatus;
}

/**
 * Download the transcript JSON from Azure output path.
 * The output blob is named after the input file (e.g. audio.mp3 → audio.json).
 */
export async function getBatchJobResults(
  outputStoragePath: string,
  filename: string
): Promise<TranscriptSegment[]> {
  const jsonFilename = filename.replace(/\.[^.]+$/, '.json');
  const url = buildAzureBlobUrl(outputStoragePath, jsonFilename);
  const res = await axios.get(url);
  const data = res.data;

  // Normalise response shape — Sarvam returns chunks or timestamps array
  const rawSegments: any[] =
    data.chunks || data.timestamps || data.segments || [];

  if (!rawSegments.length && data.transcript) {
    // Flat transcript with no timestamps: return as single segment
    return [{ start: 0, end: 0, text: data.transcript }];
  }

  return rawSegments.map((s: any) => ({
    start: s.start ?? s.startTime ?? 0,
    end: s.end ?? s.endTime ?? 0,
    text: (s.text ?? s.transcript ?? '').trim(),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an Azure Blob URL by inserting a filename before the SAS query string.
 * e.g. https://acct.blob.core.windows.net/container/prefix?sas
 *   →  https://acct.blob.core.windows.net/container/prefix/filename?sas
 */
function buildAzureBlobUrl(storagePath: string, filename: string): string {
  const qIdx = storagePath.indexOf('?');
  if (qIdx === -1) return `${storagePath}/${filename}`;
  const base = storagePath.slice(0, qIdx);
  const sas = storagePath.slice(qIdx);
  return `${base}/${filename}${sas}`;
}
