/**
 * Typed API client for the OMI-TED FastAPI backend.
 * All functions throw on non-2xx responses (axios behaviour).
 */

import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const client = axios.create({ baseURL: BASE ? `${BASE}/api/v1` : '/api/v1' });

export interface Video {
  video_id: string;
  youtube_video_id: string;
  youtube_url: string;
  title: string | null;
  channel: string | null;
  duration_ms: number | null;
  fetch_status: 'pending' | 'fetching' | 'complete' | 'failed';
  transcript_source: 'auto' | 'manual';
  segment_count: number;
  error_message?: string | null;
}

export interface Segment {
  segment_id: string;
  sequence_index: number;
  start_ms: number;
  end_ms: number;
  telugu_raw: string | null;
  english_google: string | null;
  is_song: boolean;
  song_confidence: number;
  review_status: 'pending' | 'approved' | 'flagged' | 'skipped';
  active_translation_version: string;
  english_best_model?: string | null;
  english_good_model?: string | null;
  english_cheap_model?: string | null;
  english_refined?: string | null;
}

export interface SegmentListResponse {
  video_id: string;
  total: number;
  offset: number;
  limit: number;
  segments: Segment[];
}

export interface BatchJobResponse {
  job_id: string;
  total_urls: number;
  message: string;
}

export interface VideoTranslationStatus {
  video_id: string;
  total_segments: number;
  translated_count: number;
  song_count: number;
  pending_review: number;
  approved_count: number;
}

export interface TranslationResponse {
  segment_id: string;
  tier: string;
  translated_text: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  latency_ms: number;
  is_active: boolean;
}

export async function ingestVideo(youtubeUrl: string): Promise<Video> {
  const { data } = await client.post<Video>('/ingest/video', { youtube_url: youtubeUrl });
  return data;
}

export async function getVideo(videoId: string): Promise<Video> {
  const { data } = await client.get<Video>(`/ingest/video/${videoId}`);
  return data;
}

export async function listSegments(
  videoId: string,
  opts: { offset?: number; limit?: number; exclude_songs?: boolean } = {},
): Promise<SegmentListResponse> {
  const { data } = await client.get<SegmentListResponse>(
    `/ingest/video/${videoId}/segments`,
    { params: opts },
  );
  return data;
}

export async function ingestBatch(urls: string[], concurrency = 5): Promise<BatchJobResponse> {
  const { data } = await client.post<BatchJobResponse>('/ingest/batch', {
    youtube_urls: urls,
    concurrency,
  });
  return data;
}

export type Tier = 'best' | 'good' | 'cheap';

export async function translateSegment(
  segmentId: string,
  tier: Tier = 'good',
  setActive = true,
): Promise<TranslationResponse> {
  const { data } = await client.post<TranslationResponse>(
    `/translate/segment/${segmentId}`,
    { tier, set_active: setActive },
  );
  return data;
}

export async function translateVideo(
  videoId: string,
  tier: Tier = 'good',
  concurrency = 5,
  skipSongs = true,
): Promise<{ video_id: string; tier: string; message: string }> {
  const { data } = await client.post(
    `/translate/video/${videoId}`,
    { tier, concurrency, skip_songs: skipSongs, set_active: true },
  );
  return data;
}

export async function getVideoTranslationStatus(videoId: string): Promise<VideoTranslationStatus> {
  const { data } = await client.get<VideoTranslationStatus>(
    `/translate/video/${videoId}/status`,
  );
  return data;
}

export async function approveSegment(segmentId: string, reviewerId?: string) {
  const { data } = await client.post(`/translate/segment/${segmentId}/approve`, {
    reviewer_id: reviewerId ?? null,
  });
  return data;
}

export async function editSegment(
  segmentId: string,
  englishText: string,
  reviewerId?: string,
  notes?: string,
) {
  const { data } = await client.post(`/translate/segment/${segmentId}/edit`, {
    english_text: englishText,
    reviewer_id: reviewerId ?? null,
    notes: notes ?? null,
  });
  return data;
}

export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
