'use client';

import { useState, useEffect } from 'react';
import { Cpu, CheckCircle, RefreshCw, Loader2, Search, Database, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';
import { fetchAvailableModels, getStoredApiKeys, type OpenRouterModel } from '@/lib/api';

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface RegisteredModel {
  model_id: string;
  model_name: string;
  display_name: string;
  provider: string;
  model_type: string;
  tier: string | null;
  is_active: boolean;
  supports_telugu: boolean;
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  context_window: number | null;
}

const TIER_COLORS: Record<string, string> = {
  best:  'bg-purple-100 text-purple-700',
  good:  'bg-blue-100 text-blue-700',
  cheap: 'bg-gray-100 text-gray-600',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  cohere: 'Cohere',
};

function providerLabel(p: string) {
  return PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

type Tab = 'available' | 'registered';

export default function ModelsPage() {
  const [tab, setTab] = useState<Tab>('available');
  const [registered, setRegistered] = useState<RegisteredModel[]>([]);
  const [available, setAvailable] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadRegistered = async () => {
    try {
      const { data } = await axios.get(`${BASE}/api/v1/models`);
      setRegistered(data);
    } catch {
      setRegistered([]);
    }
  };

  const loadAvailable = async () => {
    try {
      const apiKey = getStoredApiKeys().openrouter || undefined;
      const data = await fetchAvailableModels(apiKey);
      setAvailable(data);
    } catch {
      setAvailable([]);
    }
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadRegistered(), loadAvailable()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredAvailable = query.trim()
    ? available.filter((m) =>
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.toLowerCase().includes(query.toLowerCase())
      )
    : available;

  const groupedAvailable = filteredAvailable.reduce<Record<string, OpenRouterModel[]>>((acc, m) => {
    (acc[m.provider] = acc[m.provider] || []).push(m);
    return acc;
  }, {});

  const translationModels = registered.filter((m) => m.model_type === 'translation');
  const otherModels = registered.filter((m) => m.model_type !== 'translation');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Models</h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse all LLM models and manage your registry</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border px-3 py-2 rounded-md"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5">
        <button
          onClick={() => setTab('available')}
          className={clsx(
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'available'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          )}
        >
          <Globe className="w-4 h-4" /> Available on OpenRouter
          {available.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{available.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('registered')}
          className={clsx(
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'registered'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          )}
        >
          <Database className="w-4 h-4" /> Registered ({registered.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tab === 'available' ? (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by model name or provider (e.g. 'gemma', 'llama', 'claude')..."
              className="w-full text-sm border rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {available.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-500">
              <p>No models loaded from OpenRouter.</p>
              <p className="text-xs text-gray-400 mt-1">
                Make sure the backend is running and OPENROUTER_API_KEY is set (or add it in Settings).
              </p>
            </div>
          ) : Object.keys(groupedAvailable).length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No models match your search.</div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedAvailable).sort(([a], [b]) => a.localeCompare(b)).map(([provider, items]) => (
                <section key={provider}>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {providerLabel(provider)} <span className="text-gray-400 font-normal">({items.length})</span>
                  </h2>
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2">Model</th>
                          <th className="px-4 py-2">ID</th>
                          <th className="px-4 py-2">Context</th>
                          <th className="px-4 py-2">Cost/1k in</th>
                          <th className="px-4 py-2">Cost/1k out</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{m.name}</td>
                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">{m.id}</td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {m.context_length ? `${(m.context_length / 1000).toFixed(0)}k` : '—'}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-600">
                              {m.cost_input_per_1k > 0 ? `$${m.cost_input_per_1k.toFixed(4)}` : 'free'}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-600">
                              {m.cost_output_per_1k > 0 ? `$${m.cost_output_per_1k.toFixed(4)}` : 'free'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {translationModels.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Translation Models</h2>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Input/1k</th>
                      <th className="px-4 py-3">Output/1k</th>
                      <th className="px-4 py-3">Telugu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {translationModels.map((m) => (
                      <tr key={m.model_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-gray-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{m.display_name}</p>
                              <p className="text-xs text-gray-400 font-mono">{m.model_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{m.provider}</td>
                        <td className="px-4 py-3">
                          {m.tier ? (
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TIER_COLORS[m.tier] || 'bg-gray-100 text-gray-600')}>
                              {m.tier}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          ${m.cost_per_1k_input_tokens.toFixed(5)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          ${m.cost_per_1k_output_tokens.toFixed(5)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.supports_telugu && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {otherModels.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">ASR / TTS Models</h2>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Telugu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {otherModels.map((m) => (
                      <tr key={m.model_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{m.display_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{m.model_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 uppercase text-xs font-medium">{m.model_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{m.provider}</td>
                        <td className="px-4 py-3 text-center">
                          {m.supports_telugu && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {registered.length === 0 && (
            <div className="text-center py-16 text-sm text-gray-500">No registered models yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
