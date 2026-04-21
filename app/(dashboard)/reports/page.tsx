'use client';
import { useState, useEffect } from 'react';
import { BarChart2, Loader2, RefreshCw, TrendingUp, Video, Languages } from 'lucide-react';
import axios from 'axios';
const BASE = process.env.NEXT_PUBLIC_API_BASE || '';
interface ReportStats { total_videos:number; complete_videos:number; total_segments:number; translated_segments:number; approved_segments:number; song_segments:number; total_cost_usd:number; total_tokens_input:number; total_tokens_output:number; active_reviewers:number; }
interface ModelCostRow { model_name:string; provider:string; tier:string; translation_count:number; total_cost_usd:number; avg_latency_ms:number; }
function StatCard({ label, value, sub, icon: Icon }: { label:string; value:string|number; sub?:string; icon:React.ComponentType<{className?:string}> }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span><Icon className="w-4 h-4 text-gray-300" /></div>
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
const ZERO: ReportStats = { total_videos:0, complete_videos:0, total_segments:0, translated_segments:0, approved_segments:0, song_segments:0, total_cost_usd:0, total_tokens_input:0, total_tokens_output:0, active_reviewers:0 };
export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats>(ZERO);
  const [modelCosts, setModelCosts] = useState<ModelCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.allSettled([axios.get(`${BASE}/api/v1/reports/overview`), axios.get(`${BASE}/api/v1/reports/model-costs`)]);
      if (s.status==='fulfilled') setStats(s.value.data);
      if (m.status==='fulfilled') setModelCosts(m.value.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const tPct = stats.total_segments ? Math.round((stats.translated_segments/stats.total_segments)*100) : 0;
  const aPct = stats.total_segments ? Math.round((stats.approved_segments/stats.total_segments)*100) : 0;
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold text-gray-900">Reports</h1><p className="text-sm text-gray-500 mt-0.5">Platform-wide translation progress and cost breakdown</p></div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-600 border px-3 py-2 rounded-md"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      {loading ? <div className="flex items-center justify-center py-16 gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Videos" value={stats.total_videos} sub={`${stats.complete_videos} complete`} icon={Video} />
            <StatCard label="Segments" value={stats.total_segments} sub={`${stats.song_segments} songs excluded`} icon={Languages} />
            <StatCard label="Translated" value={`${tPct}%`} sub={`${stats.translated_segments.toLocaleString()} segments`} icon={TrendingUp} />
            <StatCard label="Total cost" value={`$${stats.total_cost_usd.toFixed(4)}`} sub={`${(stats.total_tokens_input+stats.total_tokens_output).toLocaleString()} tokens`} icon={BarChart2} />
          </div>
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Progress Overview</h2>
            <div className="space-y-4">
              <div><div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Translation progress</span><span className="font-medium">{tPct}%</span></div><div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full" style={{width:`${tPct}%`}} /></div></div>
              <div><div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Review &amp; approval</span><span className="font-medium">{aPct}%</span></div><div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width:`${aPct}%`}} /></div></div>
            </div>
          </div>
          {modelCosts.length > 0 ? (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b"><h2 className="text-sm font-semibold text-gray-700">Cost by Model</h2></div>
              <table className="w-full text-left"><thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider"><tr><th className="px-4 py-3">Model</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Translations</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Avg latency</th></tr></thead><tbody className="divide-y divide-gray-100">{modelCosts.map((r) => (<tr key={r.model_name} className="hover:bg-gray-50"><td className="px-4 py-3 text-sm font-medium">{r.model_name}</td><td className="px-4 py-3 text-sm capitalize">{r.provider}</td><td className="px-4 py-3 text-sm capitalize">{r.tier||'—'}</td><td className="px-4 py-3 text-sm">{r.translation_count.toLocaleString()}</td><td className="px-4 py-3 text-sm font-mono">${r.total_cost_usd.toFixed(4)}</td><td className="px-4 py-3 text-sm">{r.avg_latency_ms}ms</td></tr>))}</tbody></table>
            </div>
          ) : (
            <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No translation data yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
