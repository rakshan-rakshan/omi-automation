'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircle,
  Edit2,
  Music,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  approveSegment,
  editSegment,
  translateSegment,
  type Segment,
  type Tier,
  formatMs,
} from '@/lib/api';

interface ParallelEditorProps {
  segments: Segment[];
  videoId: string;
  onSegmentUpdate?: (updated: Segment) => void;
}

type Version = 'google' | 'best' | 'good' | 'cheap' | 'refined';

const VERSION_LABELS: Record<Version, string> = {
  google:  'Google',
  refined: 'Reviewed',
  best:    'Best AI',
  good:    'Good AI',
  cheap:   'Draft AI',
};

function getBestText(seg: Segment): string {
  return (
    seg.english_refined ||
    seg.english_best_model ||
    seg.english_good_model ||
    seg.english_cheap_model ||
    seg.english_google ||
    ''
  );
}

function getVersionText(seg: Segment, version: Version): string {
  const map: Record<Version, string | null | undefined> = {
    google:  seg.english_google,
    refined: seg.english_refined,
    best:    seg.english_best_model,
    good:    seg.english_good_model,
    cheap:   seg.english_cheap_model,
  };
  return map[version] || '';
}

function getAvailableVersions(seg: Segment): Version[] {
  const all: Version[] = ['refined', 'best', 'good', 'cheap', 'google'];
  return all.filter((v) => !!getVersionText(seg, v));
}

function SegmentRow({ seg, showSongs, onUpdate }: { seg: Segment; index: number; showSongs: boolean; onUpdate: (updated: Segment) => void }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [activeVersion, setActiveVersion] = useState<Version>(() => {
    if (seg.english_refined) return 'refined';
    if (seg.english_best_model) return 'best';
    if (seg.english_good_model) return 'good';
    if (seg.english_cheap_model) return 'cheap';
    return 'google';
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableVersions = getAvailableVersions(seg);
  const displayText = getVersionText(seg, activeVersion) || getBestText(seg);

  const isSong = seg.is_song;
  if (isSong && !showSongs) return null;

  const startEdit = () => { setEditText(displayText); setEditing(true); setTimeout(() => textareaRef.current?.focus(), 0); };
  const cancelEdit = () => { setEditing(false); setEditText(''); };

  const saveEdit = async () => {
    if (!editText.trim() || editText === displayText) { cancelEdit(); return; }
    setSaving(true);
    try {
      await editSegment(seg.segment_id, editText.trim());
      onUpdate({ ...seg, english_refined: editText.trim(), review_status: 'approved' });
      setActiveVersion('refined');
      setEditing(false);
    } catch {} finally { setSaving(false); }
  };

  const approve = async () => {
    setSaving(true);
    try { await approveSegment(seg.segment_id); onUpdate({ ...seg, review_status: 'approved' }); }
    finally { setSaving(false); }
  };

  const retranslate = async (tier: Tier) => {
    setTranslating(true);
    try {
      const result = await translateSegment(seg.segment_id, tier);
      const update: Partial<Segment> = {};
      if (tier === 'best') update.english_best_model = result.translated_text;
      if (tier === 'good') update.english_good_model = result.translated_text;
      if (tier === 'cheap') update.english_cheap_model = result.translated_text;
      onUpdate({ ...seg, ...update });
      setActiveVersion(tier);
    } finally { setTranslating(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const isApproved = seg.review_status === 'approved';

  return (
    <div className={clsx('grid grid-cols-2 gap-0 border-b last:border-0 transition-colors', isSong ? 'opacity-50 bg-purple-50/30' : 'hover:bg-gray-50/60', isApproved && 'bg-green-50/30')}>
      <div className="col-span-2 flex items-center gap-2 px-4 pt-2 pb-0">
        <span className="text-xs font-mono text-gray-400 w-10 shrink-0">#{seg.sequence_index + 1}</span>
        <span className="text-xs text-gray-400">{formatMs(seg.start_ms)} → {formatMs(seg.end_ms)}</span>
        {isSong && <span className="inline-flex items-center gap-1 text-xs text-purple-600"><Music className="w-3 h-3" /> Song</span>}
        {isApproved && <span className="inline-flex items-center gap-1 text-xs text-green-600 ml-auto"><CheckCircle className="w-3 h-3" /> Approved</span>}
      </div>

      <div className="px-4 py-2 border-r text-sm text-gray-800 leading-relaxed">
        {seg.telugu_raw || <span className="text-gray-300 italic">—</span>}
      </div>

      <div className="px-4 py-2 relative">
        {availableVersions.length > 1 && (
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {availableVersions.map((v) => (
              <button key={v} onClick={() => setActiveVersion(v)} className={clsx('text-xs px-2 py-0.5 rounded border transition-colors', activeVersion === v ? 'bg-brand-600 text-white border-brand-600' : 'text-gray-500 border-gray-200 hover:border-gray-400')}>
                {VERSION_LABELS[v]}
              </button>
            ))}
          </div>
        )}

        {editing ? (
          <div>
            <textarea ref={textareaRef} value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={handleKeyDown} rows={3} className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <div className="flex items-center gap-2 mt-1.5">
              <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1 text-xs bg-brand-600 text-white px-3 py-1 rounded hover:bg-brand-700 disabled:opacity-50">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save (Ctrl+↵)
              </button>
              <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-800">Cancel (Esc)</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed min-h-[1.5rem]">
            {displayText || <span className="text-gray-300 italic">No translation</span>}
          </p>
        )}

        {!editing && (
          <div className="flex items-center gap-2 mt-1.5">
            <button onClick={startEdit} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 border border-gray-200 hover:border-brand-300 px-2 py-0.5 rounded">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
            {!isApproved && displayText && (
              <button onClick={approve} disabled={saving} className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 border border-green-200 hover:border-green-400 px-2 py-0.5 rounded">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Approve
              </button>
            )}
            {!translating ? (
              <div className="relative group ml-auto">
                <button className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                  <RotateCcw className="w-3 h-3" /> Retranslate
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 bg-white border rounded shadow-md text-xs min-w-[100px]">
                  {(['best', 'good', 'cheap'] as Tier[]).map((tier) => (
                    <button key={tier} onClick={() => retranslate(tier)} className="block w-full text-left px-3 py-1.5 hover:bg-gray-50 capitalize">{tier}</button>
                  ))}
                </div>
              </div>
            ) : (<Loader2 className="w-3 h-3 animate-spin text-brand-500 ml-auto" />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParallelEditor({ segments, videoId, onSegmentUpdate }: ParallelEditorProps) {
  const [showSongs, setShowSongs] = useState(false);
  const [localSegments, setLocalSegments] = useState(segments);

  useEffect(() => { setLocalSegments(segments); }, [segments]);

  const handleUpdate = useCallback((updated: Segment) => {
    setLocalSegments((prev) => prev.map((s) => (s.segment_id === updated.segment_id ? updated : s)));
    onSegmentUpdate?.(updated);
  }, [onSegmentUpdate]);

  const songCount = localSegments.filter((s) => s.is_song).length;
  const approvedCount = localSegments.filter((s) => s.review_status === 'approved').length;
  const visibleCount = showSongs ? localSegments.length : localSegments.length - songCount;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-4 py-2.5 border-b bg-white text-sm shrink-0">
        <span className="text-gray-500">{visibleCount} segments · {approvedCount} approved</span>
        {songCount > 0 && (
          <button onClick={() => setShowSongs((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 px-2 py-0.5 rounded">
            <Music className="w-3 h-3" />
            {showSongs ? 'Hide' : 'Show'} {songCount} song segment{songCount !== 1 ? 's' : ''}
          </button>
        )}
        <div className="ml-auto text-xs text-gray-400">Ctrl+↵ approve · Esc cancel</div>
      </div>

      <div className="grid grid-cols-2 border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider shrink-0">
        <div className="px-4 py-2 border-r">Telugu (Source)</div>
        <div className="px-4 py-2">English (Translation)</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {localSegments.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No segments loaded</div>
        ) : (
          localSegments.map((seg, i) => (<SegmentRow key={seg.segment_id} seg={seg} index={i} showSongs={showSongs} onUpdate={handleUpdate} />))
        )}
      </div>
    </div>
  );
}
