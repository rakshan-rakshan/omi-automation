'use client';
import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle } from 'lucide-react';
interface AppSettings { default_tier:'best'|'good'|'cheap'; ingest_concurrency:number; translate_concurrency:number; youtube_rate_limit:number; auto_translate_on_ingest:boolean; auto_detect_songs:boolean; }
const DEFAULTS: AppSettings = { default_tier:'good', ingest_concurrency:5, translate_concurrency:5, youtube_rate_limit:10, auto_translate_on_ingest:false, auto_detect_songs:true };
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { const s = localStorage.getItem('omited_settings'); if (s) setSettings({ ...DEFAULTS, ...JSON.parse(s) }); } catch {} }, []);
  const save = () => { setSaving(true); localStorage.setItem('omited_settings', JSON.stringify(settings)); setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 400); };
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setSettings((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6"><h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-400" /> Settings</h1><p className="text-sm text-gray-500 mt-0.5">Application preferences and defaults</p></div>
      <div className="bg-white border rounded-xl divide-y">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Translation</h2>
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-600 mb-1">Default tier</label>
              <select value={settings.default_tier} onChange={(e) => set('default_tier', e.target.value as AppSettings['default_tier'])} className="text-sm border rounded-md px-3 py-1.5 bg-white w-48">
                <option value="cheap">Draft (fast)</option><option value="good">Good (balanced)</option><option value="best">Best (quality)</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.auto_translate_on_ingest} onChange={(e) => set('auto_translate_on_ingest', e.target.checked)} className="w-4 h-4 rounded border-gray-300" /><span className="text-sm text-gray-700">Auto-translate after ingest</span></label>
          </div>
        </div>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Ingest</h2>
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-600 mb-1">YouTube rate limit (req/min)</label><input type="number" min={1} max={20} value={settings.youtube_rate_limit} onChange={(e) => set('youtube_rate_limit', Number(e.target.value))} className="text-sm border rounded-md px-3 py-1.5 w-24" /></div>
            <div><label className="block text-sm text-gray-600 mb-1">Ingest concurrency</label><input type="number" min={1} max={10} value={settings.ingest_concurrency} onChange={(e) => set('ingest_concurrency', Number(e.target.value))} className="text-sm border rounded-md px-3 py-1.5 w-24" /></div>
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.auto_detect_songs} onChange={(e) => set('auto_detect_songs', e.target.checked)} className="w-4 h-4 rounded border-gray-300" /><span className="text-sm text-gray-700">Auto-detect songs on ingest</span></label>
          </div>
        </div>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Performance</h2>
          <div><label className="block text-sm text-gray-600 mb-1">Translation concurrency</label><input type="number" min={1} max={10} value={settings.translate_concurrency} onChange={(e) => set('translate_concurrency', Number(e.target.value))} className="text-sm border rounded-md px-3 py-1.5 w-24" /><p className="text-xs text-gray-400 mt-1">Parallel LLM calls per batch job.</p></div>
        </div>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Backend</h2>
          <div><label className="block text-sm text-gray-600 mb-1">API URL</label><input type="text" value={process.env.NEXT_PUBLIC_API_BASE || '(not configured)'} readOnly className="text-sm border rounded-md px-3 py-1.5 w-72 bg-gray-50 text-gray-500 font-mono" /><p className="text-xs text-gray-400 mt-1">Set via NEXT_PUBLIC_API_BASE env var.</p></div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings
        </button>
        {saved && <span className="inline-flex items-center gap-1.5 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  );
}
