/**
 * Sarvam AI Speech-to-Text-Translate (STTT) Batch API
 * Verified endpoints from: sarvamai/sarvam-ai-cookbook (stt-translate-batch-api notebook)
 *
 *   POST /speech-to-text-translate/job/init  → { job_id, input_storage_path, output_storage_path }
 *   ADLS Gen2 create→append→flush            → upload audio file
 *   POST /speech-to-text-translate/job        → start job { job_id, job_parameters }
 *   GET  /speech-to-text-translate/job/{id}/status → { job_state, job_details[] }
 *   GET  {outputStoragePath}/{file_id}.json   → transcript JSON
 */

import axios from 'axios';

const BASE = 'https://api.sarvam.ai';

function getApiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY environment variable is not set');
  return key;
}

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

export type BatchStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

/** Initialise a new STTT batch job. Returns Azure ADLS paths for audio upload. */
export async function initBatchJob(): Promise<BatchJobInit> {
  const res = await axios.post(
    `${BASE}/speech-to-text-translate/job/init`,
    {},
    { headers: { 'api-subscription-key': getApiKey() } }
  );
  // API returns snake_case: job_id, input_storage_path, output_storage_path
  const { job_id, input_storage_path, output_storage_path } = res.data;
  console.log(`STTT batch job initialised: ${job_id}`);
  return {
    jobId: job_id,
    inputStoragePath: input_storage_path,
    outputStoragePath: output_storage_path,
  };
}

/**
 * Download audio from Apify CDN and upload to Azure Data Lake Gen2.
 * ADLS Gen2 requires: create file → append data → flush (not a simple blob PUT).
 */
export async function streamAudioToAzure(
  inputStoragePath: string,
  audioUrl: string,
  filename: string
): Promise<void> {
  const audioRes = await axios.get(audioUrl, {
    responseType: 'arraybuffer',
    maxContentLength: Infinity,
  });
  const buffer = Buffer.from(audioRes.data);
  const contentType: string =
    (audioRes.headers['content-type'] as string)?.split(';')[0] || 'audio/mpeg';

  await uploadToAdlsGen2(inputStoragePath, buffer, filename, contentType);
  console.log(`Uploaded ${buffer.length} bytes to ADLS as ${filename}`);
}

/**
 * Start the STTT batch job.
 * Body must be { job_id, job_parameters } — no language_code (model auto-detects).
 */
export async function startBatchJob(jobId: string): Promise<void> {
  await axios.post(
    `${BASE}/speech-to-text-translate/job`,
    { job_id: jobId, job_parameters: { with_diarization: false } },
    {
      headers: {
        'api-subscription-key': getApiKey(),
        'Content-Type': 'application/json',
      },
    }
  );
  console.log(`STTT batch job started: ${jobId}`);
}

/** Poll job status — response field is job_state, not status. */
export async function getBatchJobStatus(jobId: string): Promise<BatchStatus> {
  const res = await axios.get(
    `${BASE}/speech-to-text-translate/job/${jobId}/status`,
    { headers: { 'api-subscription-key': getApiKey() } }
  );
  return res.data.job_state as BatchStatus;
}

/**
 * Download transcript JSON from Azure ADLS output path.
 * Output files are named {file_id}.json — get file_id from job status.
 */
export async function getBatchJobResults(
  jobId: string,
  outputStoragePath: string
): Promise<TranscriptSegment[]> {
  // Fetch job details to resolve file_id → output filename
  const statusRes = await axios.get(
    `${BASE}/speech-to-text-translate/job/${jobId}/status`,
    { headers: { 'api-subscription-key': getApiKey() } }
  );
  const jobDetails: Array<{ file_id: string; file_name: string; state: string }> =
    statusRes.data.job_details ?? [];
  const fileId = jobDetails[0]?.file_id ?? '0';

  const outputUrl = buildAdlsUrl(outputStoragePath, `${fileId}.json`);
  console.log(`Fetching transcript from: ${outputUrl.split('?')[0]}`);
  const res = await axios.get(outputUrl);
  const data = res.data;

  const rawSegments: any[] = data.chunks ?? data.timestamps ?? data.segments ?? [];

  if (!rawSegments.length && data.transcript) {
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

/** Upload a pre-buffered audio file to Azure and log the size. */
export async function uploadAudioBuffer(
  inputStoragePath: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  await uploadToAdlsGen2(inputStoragePath, buffer, filename, contentType);
  console.log(`Uploaded ${buffer.length} bytes to ADLS as ${filename}`);
}

/**
 * Upload buffer to Azure storage. Detects the storage type from the URL:
 *   - blob.core.windows.net → Blob Storage: single PUT with x-ms-blob-type
 *   - dfs.core.windows.net  → ADLS Gen2: create → append → flush sequence
 */
async function uploadToAdlsGen2(
  storagePath: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  const sepIdx = storagePath.indexOf('?');
  const pathBase = sepIdx === -1 ? storagePath : storagePath.slice(0, sepIdx);
  const sasParams = sepIdx === -1 ? '' : storagePath.slice(sepIdx + 1);
  const fileBase = `${pathBase}/${filename}`;

  if (storagePath.includes('.blob.core.windows.net')) {
    // Azure Blob Storage — simple single PUT
    await axios.put(`${fileBase}?${sasParams}`, buffer, {
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return;
  }

  // ADLS Gen2 — create → append → flush
  const mkUrl = (extra: Record<string, string>) => {
    const p = new URLSearchParams(sasParams);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `${fileBase}?${p.toString()}`;
  };

  await axios.put(mkUrl({ resource: 'file' }), '', {
    headers: { 'Content-Length': '0' },
  });

  await axios.patch(mkUrl({ action: 'append', position: '0' }), buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  await axios.patch(mkUrl({ action: 'flush', position: String(buffer.length) }), '', {
    headers: {
      'x-ms-content-type': contentType,
      'Content-Length': '0',
    },
  });
}

/**
 * Insert filename before the SAS query string.
 * "https://account.dfs.../dir?sas" + "file.json" → "https://.../dir/file.json?sas"
 */
function buildAdlsUrl(storagePath: string, filename: string): string {
  const qIdx = storagePath.indexOf('?');
  if (qIdx === -1) return `${storagePath}/${filename}`;
  return `${storagePath.slice(0, qIdx)}/${filename}${storagePath.slice(qIdx)}`;
}
