'use client';
import { useState, useEffect } from 'react';
import { Cpu, CheckCircle, RefreshCw, Loader2, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';
const BASE = process.env.NEXT_PUBLIC_API_BASE || '';
interface Model { model_id:string; model_name:string; display_name:string; provider:string; model_type:string; tier:string|null; is_active:boolean; supports_telugu:boolean; cost_per_1k_input_tokens:number; cost_per_1k_output_tokens:number; context_window:number|null; }
const TIER_COLORS: Record<string,string> = { best:'bg-purple-100 text-purple-700', good:'bg-blue-100 text-blue-700', cheap:'bg-gray-100 text-gray-600' };
const SEED_MODELS: Model[] = [
  { model_id:'1', model_name:'claude-sonnet-4-6', display_name:'Claude Sonnet 4.6', provider:'anthropic', model_type:'translation', tier:'best', is_active:true, supports_telugu:false, cost_per_1k_input_tokens:0.003, cost_per_1k_output_tokens:0.015, context_window:200000 },
  { model_id:'2', model_name:'gpt-4o', display_name:'GPT-4o', provider:'openai', model_type:'translation', tier:'best', is_active:true, supports_telugu:false, cost_per_1k_input_tokens:0.005, cost_per_1k_output_tokens:0.015, context_window:128000 },
  { model_id:'3', model_name:'gemini-1.5-flash', display_name:'Gemini 1.5 Flash', provider:'google', model_type:'translation', tier:'good', is_active:true, supports_telugu:false, cost_per_1k_input_tokens:0.000075, cost_per_1k_output_tokens:0.0003, context_window:1048576 },
  { model_id:'4', model_name:'sarvam-translate', display_name:'Sarvam Translate', provider:'sarvam', model_type:'translation', tier:'good', is_active:true, supports_telugu:true, cost_per_1k_input_tokens:0.0005, cost_per_1k_output_tokens:0.0005, context_window:8192 },
  { model_id:'5', model_name:'gemma-7b-it', display_name:'Gemma 7B Instruct', provider:'openrouter', model_type:'translation', tier:'cheap', is_active:true, supports_telugu:false, cost_per_1k_input_tokens:0.00007, cost_per_1k_output_tokens:0.00007, context_window:8192 },
  { model_id:'6', model_name:'saarika:v2.5', display_name:'Sarvam ASR v2.5', provider:'sarvam', model_type:'asr', tier:null, is_active:true, supports_telugu:true, cost_per_1k_input_tokens:0, cost_per_1k_output_tokens:0, context_window:null },
  { model_id:'7', model_name:'bulbul:v2', display_name:'Sarvam TTS Bulbul', provider:'sarvam', model_type:'tts', tier:null, is_active:true, supports_telugu:true, cost_per_1k_input_tokens:0, cost_per_1k_output_tokens:0, context_window:null },
];
export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState<string|null>(null);
  const load = async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${BASE}/api/v1/models`); setModels(data); }
    catch { setModels(SEED_MODELS); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const runMigration = async (tier: string) => {
    setMigrating(tier);
    try { await axios.post(`${BASE}/api/v1/models/migrate`, { tier }); alert(`Migration to ${tier} tier started.`); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Migration failed'); }
    finally { setMigrating(null); }
  };
  const translationModels = models.filter((m) => m.model_type === 'translation');
  const otherModels = models.filter((m) => m.model_type !== 'translation');
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold text-gray-900">Model Registry</h1><p className="text-sm text-gray-500 mt-0.5">Manage translation, ASR, and TTS models</p></div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border px-3 py-2 rounded-md"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      {loading ? <div className="flex items-center justify-center py-16 gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Translation Models</h2>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                  <tr><th className="px-4 py-3">Model</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Input/1k</th><th className="px-4 py-3">Output/1k</th><th className="px-4 py-3">Telugu</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {translationModels.map((m) => (
                    <tr key={m.model_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-gray-400" /><div><p className="text-sm font-medium">{m.display_name}</p><p className="text-xs text-gray-400 font-mono">{m.model_name}</p></div></div></td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{m.provider}</td>
                      <td className="px-4 py-3">{m.tier ? <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TIER_COLORS[m.tier])}>{m.tier}</span> : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono">${m.cost_per_1k_input_tokens.toFixed(5)}</td>
                      <td className="px-4 py-3 text-sm font-mono">${m.cost_per_1k_output_tokens.toFixed(5)}</td>
                      <td className="px-4 py-3 text-center">{m.supports_telugu && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}</td>
                      <td className="px-4 py-3 text-right">{m.tier && <button onClick={() => runMigration(m.tier!)} disabled={migrating===m.tier} className="inline-flex items-center gap-1 text-xs text-brand-600 border border-brand-200 px-2 py-0.5 rounded">{migrating===m.tier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Migrate</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {otherModels.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">ASR / TTS Models</h2>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider"><tr><th className="px-4 py-3">Model</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Telugu</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{otherModels.map((m) => (<tr key={m.model_id} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="text-sm font-medium">{m.display_name}</p><p className="text-xs text-gray-400 font-mono">{m.model_name}</p></td><td className="px-4 py-3 text-xs font-medium uppercase text-gray-600">{m.model_type}</td><td className="px-4 py-3 text-sm text-gray-600 capitalize">{m.provider}</td><td className="px-4 py-3 text-center">{m.supports_telugu && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}</td></tr>))}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
