'use client';
import { useState } from 'react';
import { Database, Download, Loader2, FileJson, FileText, FileCode, Archive } from 'lucide-react';
import axios from 'axios';
const BASE = process.env.NEXT_PUBLIC_API_BASE || '';
type Format = 'jsonl'|'csv'|'tmx'|'srt_aligned';
const FORMATS = [
  { id:'jsonl' as Format, label:'JSONL', description:'HuggingFace-compatible, one JSON per line.', icon:FileJson, mime:'application/jsonl', ext:'jsonl' },
  { id:'csv' as Format, label:'CSV', description:'Flat spreadsheet format, BOM-encoded for Excel.', icon:FileText, mime:'text/csv', ext:'csv' },
  { id:'tmx' as Format, label:'TMX', description:'Translation Memory eXchange 1.4b for CAT tools.', icon:FileCode, mime:'application/xml', ext:'tmx' },
  { id:'srt_aligned' as Format, label:'SRT Zip', description:'Parallel SRT files bundled in a ZIP.', icon:Archive, mime:'application/zip', ext:'zip' },
];
export default function DatasetPage() {
  const [format, setFormat] = useState<Format>('jsonl');
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [excludeSongs, setExcludeSongs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{rows:number;videos:number}|null>(null);
  const [error, setError] = useState('');
  const fetchStats = async () => {
    try { const { data } = await axios.get(`${BASE}/api/v1/dataset/stats`, { params:{approved_only:approvedOnly,exclude_songs:excludeSongs} }); setStats(data); } catch { setStats(null); }
  };
  const download = async () => {
    setLoading(true); setError('');
    try {
      const resp = await axios.get(`${BASE}/api/v1/dataset/export`, { params:{fmt:format,approved_only:approvedOnly,exclude_songs:excludeSongs}, responseType:'blob' });
      const opt = FORMATS.find((f) => f.id===format)!;
      const url = window.URL.createObjectURL(new Blob([resp.data],{type:opt.mime}));
      const a = document.createElement('a'); a.href=url; a.download=`omited-dataset-${new Date().toISOString().split('T')[0]}.${opt.ext}`; a.click(); window.URL.revokeObjectURL(url);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Export failed'); } finally { setLoading(false); }
  };
  const selected = FORMATS.find((f) => f.id===format)!;
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6"><h1 className="text-xl font-semibold text-gray-900">Dataset Export</h1><p className="text-sm text-gray-500 mt-0.5">Export your Telugu→English translation corpus.</p></div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {FORMATS.map((f) => { const Icon=f.icon; return (
          <button key={f.id} onClick={() => setFormat(f.id)} className={`text-left p-4 rounded-xl border-2 transition-colors ${format===f.id ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className={`w-4 h-4 ${format===f.id ? 'text-brand-600':'text-gray-400'}`} /><span className={`text-sm font-semibold ${format===f.id ? 'text-brand-700':'text-gray-700'}`}>{f.label}</span></div>
            <p className="text-xs text-gray-500">{f.description}</p>
          </button>
        ); })}
      </div>
      <div className="bg-white border rounded-xl p-4 mb-6 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Export Filters</h2>
        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} className="w-4 h-4 rounded border-gray-300" /><span className="text-sm text-gray-700">Approved segments only</span></label>
        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={excludeSongs} onChange={(e) => setExcludeSongs(e.target.checked)} className="w-4 h-4 rounded border-gray-300" /><span className="text-sm text-gray-700">Exclude song segments</span></label>
      </div>
      {stats && <div className="flex items-center gap-4 text-sm text-gray-600 mb-4"><Database className="w-4 h-4 text-gray-400" /><span><strong>{stats.rows.toLocaleString()}</strong> segments across <strong>{stats.videos}</strong> videos</span></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      <div className="flex gap-3">
        <button onClick={fetchStats} className="text-sm text-gray-600 border px-4 py-2 rounded-md">Check row count</button>
        <button onClick={download} disabled={loading} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? 'Generating…' : `Download ${selected.label}`}
        </button>
      </div>
    </div>
  );
}
