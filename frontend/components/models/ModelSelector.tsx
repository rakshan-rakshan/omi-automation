'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ChevronDown, X, Cpu } from 'lucide-react';
import { clsx } from 'clsx';
import { fetchAvailableModels, getStoredApiKeys, type OpenRouterModel } from '@/lib/api';

interface ModelSelectorProps {
  value: string | null;
  onChange: (modelId: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  meta-llama: 'Meta',
  mistralai: 'Mistral',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  other: 'Other',
};

function providerLabel(p: string) {
  return PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

export default function ModelSelector({ value, onChange, onClear, placeholder = 'Select model...' }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || models.length > 0) return;
    setLoading(true);
    const apiKey = getStoredApiKeys().openrouter || undefined;
    fetchAvailableModels(apiKey)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? models.filter((m) =>
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.toLowerCase().includes(query.toLowerCase())
      )
    : models;

  // Group by provider
  const grouped = filtered.reduce<Record<string, OpenRouterModel[]>>((acc, m) => {
    (acc[m.provider] = acc[m.provider] || []).push(m);
    return acc;
  }, {});

  const selectedModel = value ? models.find((m) => m.id === value) : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-white hover:border-brand-400 min-w-[140px] max-w-[220px]"
      >
        <Cpu className="w-3 h-3 text-gray-400 shrink-0" />
        <span className="truncate text-gray-700 flex-1 text-left">
          {selectedModel ? selectedModel.name : placeholder}
        </span>
        {value && onClear ? (
          <X className="w-3 h-3 text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full text-xs border rounded pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-72">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models...
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No models found</div>
            ) : (
              Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([provider, items]) => (
                <div key={provider}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                    {providerLabel(provider)}
                  </div>
                  {items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { onChange(m.id); setOpen(false); setQuery(''); }}
                      className={clsx(
                        'w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors',
                        value === m.id && 'bg-brand-50',
                      )}
                    >
                      <div className="text-xs font-medium text-gray-800 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-3">
                        <span>{m.id}</span>
                        {(m.cost_input_per_1k > 0 || m.cost_output_per_1k > 0) && (
                          <span className="text-gray-300">·</span>
                        )}
                        {m.cost_input_per_1k > 0 && (
                          <span>${m.cost_input_per_1k.toFixed(4)}/1k in</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
