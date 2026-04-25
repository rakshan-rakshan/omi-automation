'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle, Key, Eye, EyeOff } from 'lucide-react';

interface AppSettings {
  default_tier: 'best' | 'good' | 'cheap';
  ingest_concurrency: number;
  translate_concurrency: number;
  youtube_rate_limit: number;
  auto_translate_on_ingest: boolean;
  auto_detect_songs: boolean;
  cors_origins: string;
}

interface ApiKeys {
  openrouter: string;
  anthropic: string;
  openai: string;
  google: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  default_tier: 'good',
  ingest_concurrency: 5,
  translate_concurrency: 5,
  youtube_rate_limit: 10,
  auto_translate_on_ingest: false,
  auto_detect_songs: true,
  cors_origins: 'http://localhost:3000',
};

const DEFAULT_API_KEYS: ApiKeys = { openrouter: '', anthropic: '', openai: '', google: '' };

function MaskedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border rounded-md px-3 py-1.5 w-full font-mono pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(DEFAULT_API_KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('omited_settings');
    if (stored) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }); } catch { /* ignore */ }
    }
    const keys = localStorage.getItem('omited_api_keys');
    if (keys) {
      try { setApiKeys({ ...DEFAULT_API_KEYS, ...JSON.parse(keys) }); } catch { /* ignore */ }
    }
  }, []);

  const save = () => {
    setSaving(true);
    localStorage.setItem('omited_settings', JSON.stringify(settings));
    localStorage.setItem('omited_api_keys', JSON.stringify(apiKeys));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 400);
  };

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const setKey = (key: keyof ApiKeys, value: string) =>
    setApiKeys((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Application preferences and defaults</p>
      </div>

      <div className="bg-white border rounded-xl divide-y">
        {/* API Keys */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-gray-400" /> API Keys
          </h2>
          <p className="text-xs text-gray-400 mb-3">Stored locally in your browser only. Used for the model selector to route through your own keys.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">OpenRouter API Key <span className="text-brand-600">(primary — routes to any model)</span></label>
              <MaskedInput value={apiKeys.openrouter} onChange={(v) => setKey('openrouter', v)} placeholder="sk-or-..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Anthropic API Key <span className="text-gray-400">(direct — Claude models)</span></label>
              <MaskedInput value={apiKeys.anthropic} onChange={(v) => setKey('anthropic', v)} placeholder="sk-ant-..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">OpenAI API Key <span className="text-gray-400">(direct — GPT models)</span></label>
              <MaskedInput value={apiKeys.openai} onChange={(v) => setKey('openai', v)} placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Google AI API Key <span className="text-gray-400">(direct — Gemini / Gemma)</span></label>
              <MaskedInput value={apiKeys.google} onChange={(v) => setKey('google', v)} placeholder="AIza..." />
            </div>
          </div>
        </div>

        {/* Translation */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Translation</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Default translation tier</label>
              <select
                value={settings.default_tier}
                onChange={(e) => set('default_tier', e.target.value as AppSettings['default_tier'])}
                className="text-sm border rounded-md px-3 py-1.5 bg-white w-48"
              >
                <option value="cheap">Draft (fast &amp; cheap)</option>
                <option value="good">Good (balanced)</option>
                <option value="best">Best (highest quality)</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_translate_on_ingest}
                onChange={(e) => set('auto_translate_on_ingest', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700">Automatically translate after ingestion</span>
            </label>
          </div>
        </div>

        {/* Ingest */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Ingest</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">YouTube rate limit (requests/minute)</label>
              <input type="number" min={1} max={20} value={settings.youtube_rate_limit}
                onChange={(e) => set('youtube_rate_limit', Number(e.target.value))}
                className="text-sm border rounded-md px-3 py-1.5 w-24" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ingest concurrency</label>
              <input type="number" min={1} max={10} value={settings.ingest_concurrency}
                onChange={(e) => set('ingest_concurrency', Number(e.target.value))}
                className="text-sm border rounded-md px-3 py-1.5 w-24" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.auto_detect_songs}
                onChange={(e) => set('auto_detect_songs', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600" />
              <span className="text-sm text-gray-700">Auto-detect song segments on ingest</span>
            </label>
          </div>
        </div>

        {/* Performance */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Performance</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Translation concurrency</label>
            <input type="number" min={1} max={10} value={settings.translate_concurrency}
              onChange={(e) => set('translate_concurrency', Number(e.target.value))}
              className="text-sm border rounded-md px-3 py-1.5 w-24" />
            <p className="text-xs text-gray-400 mt-1">Parallel LLM calls per batch job.</p>
          </div>
        </div>

        {/* Backend */}
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Backend</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Backend API URL</label>
            <input type="text" value={process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}
              readOnly className="text-sm border rounded-md px-3 py-1.5 w-72 bg-gray-50 text-gray-500 font-mono" />
            <p className="text-xs text-gray-400 mt-1">Set via NEXT_PUBLIC_API_BASE env var.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save settings
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
