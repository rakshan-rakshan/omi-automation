'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Zap } from 'lucide-react';
import {
  listSegments, getVideo, translateVideo, getVideoTranslationStatus,
  type Video, type Segment, type VideoTranslationStatus, type Tier, formatMs,
} from '@/lib/api';
import ParallelEditor from '@/components/editor/ParallelEditor';

function TranslationBar({ status }: { status: VideoTranslationStatus }) {
  const pct = status.total_segments ? Math.round((status.translated_count / status.total_segments) * 100) : 0;
  const appPct = status.total_segments ? Math.round((status.approved_count / status.total_segments) * 100) : 0;
  return (
    <div className="flex items-center gap-6 text-sm text-gray-600">
      <div><span className="font-semibold text-gray-900">{status.total_segments}</span> segments</div>
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs">{pct}% translated</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${appPct}%` }} />
        </div>
        <span className="text-xs">{appPct}% approved</span>
      </div>
    </div>
  );
}

function TranslateControls({ videoId, onDone }: { videoId: string; onDone: () => void }) {
  const [tier, setTier] = useState<Tier>('good');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const run = async () => {
    setLoading(true); setMessage('');
    try { const r = await translateVideo(videoId, tier); setMessage(r.message); setTimeout(onDone, 3000); }
    catch (err: unknown) { setMessage(err instanceof Error ? err.message : 'Translation failed'); }
    finally { setLoading(false); }
  };
  return (
    <div className="flex items-center gap-3">
      <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className="text-sm border rounded-md px-2 py-1.5 bg-white" disabled={loading}>
        <option value="cheap">Draft (fast)</option>
        <option value="good">Good (balanced)</option>
        <option value="best">Best (quality)</option>
      </select>
      <button onClick={run} disabled={loading} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm font-medium">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Translating…' : 'Translate All'}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  );
}

function EditorInner() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get('video') ?? '';
  const [video, setVideo] = useState<Video | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<VideoTranslationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!videoId) return;
    setLoading(true); setError('');
    try {
      const [vid, segs, stat] = await Promise.all([getVideo(videoId), listSegments(videoId, { limit: 500 }), getVideoTranslationStatus(videoId)]);
      setVideo(vid); setSegments(segs.segments); setStatus(stat);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load video'); }
    finally { setLoading(false); }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  if (!videoId) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
      <p className="text-sm">No video selected. Open a video from the <Link href="/videos" className="text-brand-600 hover:underline">Videos</Link> page.</p>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">{error}</div></div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-white px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/videos" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">{video?.title || video?.youtube_video_id || 'Loading…'}</h1>
              <p className="text-xs text-gray-500 mt-0.5">{video?.channel} · {video?.duration_ms ? formatMs(video.duration_ms) : '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {status && <TranslationBar status={status} />}
            <TranslateControls videoId={videoId} onDone={load} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ParallelEditor segments={segments} videoId={videoId} onSegmentUpdate={(updated) => setSegments((prev) => prev.map((s) => (s.segment_id === updated.segment_id ? updated : s)))} />
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
      <EditorInner />
    </Suspense>
  );
}
