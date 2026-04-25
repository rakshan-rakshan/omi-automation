'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Youtube,
  Users,
  Hash,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ingestVideo, ingestBatch, getVideo, listVideos, type Video } from '@/lib/api';

function StatusBadge({ status }: { status: Video['fetch_status'] }) {
  const cfg = {
    complete: { icon: CheckCircle, cls: 'bg-green-100 text-green-800', label: 'Complete' },
    pending:  { icon: Clock,       cls: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
    fetching: { icon: Loader2,     cls: 'bg-blue-100 text-blue-700',   label: 'Fetching' },
    failed:   { icon: XCircle,     cls: 'bg-red-100 text-red-700',     label: 'Failed' },
  }[status] ?? { icon: Clock, cls: 'bg-gray-100 text-gray-700', label: status };

  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.cls)}>
      <Icon className={clsx('w-3 h-3', status === 'fetching' && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

function IngestDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const urls = input.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setLoading(true);
    setError('');
    try {
      if (urls.length === 1) {
        await ingestVideo(urls[0]);
      } else {
        await ingestBatch(urls);
      }
      setInput('');
      setOpen(false);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ingest failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Add Videos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold mb-1">Add YouTube Videos</h2>
            <p className="text-sm text-gray-500 mb-4">Paste one or more YouTube URLs, one per line.</p>
            <textarea
              rows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://youtu.be/..."
              className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setOpen(false); setError(''); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button onClick={submit} disabled={loading || !input.trim()} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Submitting...' : 'Ingest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VideoRow({ video, onRefresh }: { video: Video; onRefresh: (id: string) => void }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Youtube className="w-4 h-4 text-red-500 shrink-0" />
          <div className="min-w-0">
            <Link href={`/editor?video=${video.video_id}`} className="text-sm font-medium text-brand-600 hover:underline truncate block max-w-xs">
              {video.title || video.youtube_video_id}
            </Link>
            {video.channel && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" /> {video.channel}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap"><StatusBadge status={video.fetch_status} /></td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1"><Hash className="w-3 h-3 text-gray-400" />{video.segment_count.toLocaleString()}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {video.transcript_source === 'manual' ? <span className="text-green-700 font-medium">Manual</span> : <span className="text-gray-500">Auto</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {video.fetch_status === 'fetching' && (
            <button onClick={() => onRefresh(video.video_id)} className="text-gray-400 hover:text-gray-700" title="Refresh status"><RefreshCw className="w-4 h-4" /></button>
          )}
          {video.fetch_status === 'complete' && (
            <Link href={`/editor?video=${video.video_id}`} className="text-xs text-brand-600 hover:underline font-medium">Edit →</Link>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const vids = await listVideos();
      setVideos(vids);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const handleIngestDone = useCallback(() => { loadVideos(); }, [loadVideos]);

  const handleRefresh = useCallback(async (videoId: string) => {
    const updated = await getVideo(videoId);
    setVideos((prev) => prev.map((v) => (v.video_id === videoId ? updated : v)));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Videos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{videos.length} video{videos.length !== 1 ? 's' : ''} in the library</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadVideos} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border px-3 py-2 rounded-md">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <IngestDialog onDone={handleIngestDone} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading videos…</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16">
          <Youtube className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No videos yet. Add a YouTube URL to get started.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Video</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Segments</th>
                <th className="px-4 py-3">Transcript</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {videos.map((v) => (<VideoRow key={v.video_id} video={v} onRefresh={handleRefresh} />))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
