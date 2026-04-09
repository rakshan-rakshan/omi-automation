import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

type Step = 'idle' | 'downloading' | 'transcribing' | 'generating' | 'done' | 'error';

const STEPS: { key: Step; label: string; detail: string }[] = [
  { key: 'downloading', label: 'Downloading', detail: 'Fetching video & audio via Apify' },
  { key: 'transcribing', label: 'Transcribing', detail: 'Sarvam STTT: Telugu → English (batch)' },
  { key: 'generating', label: 'Generating', detail: 'Building captions + English audio' },
  { key: 'done', label: 'Done', detail: 'Ready to download' },
];

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64Audio(b64: string, filename: string) {
  const a = document.createElement('a');
  a.href = `data:audio/wav;base64,${b64}`;
  a.download = filename; a.click();
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<{
    englishSrt: string;
    englishAudioBase64: string;
    videoUrl: string;
    segmentCount: number;
  } | null>(null);

  // Job state kept in refs so polling closures always see latest values
  const apifyRunIdRef = useRef<string | null>(null);
  const sarvamJobIdRef = useRef<string | null>(null);
  const outputStoragePathRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  async function handleProcess() {
    if (!youtubeUrl.trim()) return;
    setStep('downloading');
    setErrorMsg('');
    setResults(null);

    try {
      // Step 1: Start Apify run
      const startRes = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start download');
      apifyRunIdRef.current = startData.apifyRunId;

      // Step 2: Poll Apify until SUCCEEDED
      await new Promise<void>((resolve, reject) => {
        pollingRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/apify-status?runId=${apifyRunIdRef.current}`);
            const d = await r.json();
            if (!r.ok) { clearInterval(pollingRef.current!); reject(new Error(d.error)); return; }
            if (d.status === 'SUCCEEDED') {
              clearInterval(pollingRef.current!);
              videoUrlRef.current = d.result?.videoUrl || null;
              // Step 3: Submit audio to Sarvam Batch STTT
              setStep('transcribing');
              const sr = await fetch('/api/sarvam-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioUrl: d.result?.audioUrl }),
              });
              const sd = await sr.json();
              if (!sr.ok) { reject(new Error(sd.error || 'Failed to start transcription')); return; }
              sarvamJobIdRef.current = sd.sarvamJobId;
              outputStoragePathRef.current = sd.outputStoragePath;
              resolve();
            } else if (d.status === 'FAILED' || d.status === 'ABORTED') {
              clearInterval(pollingRef.current!);
              reject(new Error(`Apify run ${d.status.toLowerCase()}`));
            }
          } catch (e: any) { clearInterval(pollingRef.current!); reject(e); }
        }, 4000);
      });

      // Step 4: Poll Sarvam until Completed
      await new Promise<void>((resolve, reject) => {
        pollingRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/sarvam-status?jobId=${sarvamJobIdRef.current}`);
            const d = await r.json();
            if (!r.ok) { clearInterval(pollingRef.current!); reject(new Error(d.error)); return; }
            if (d.status === 'Completed') {
              clearInterval(pollingRef.current!);
              resolve();
            } else if (d.status === 'Failed') {
              clearInterval(pollingRef.current!);
              reject(new Error('Sarvam transcription failed'));
            }
          } catch (e: any) { clearInterval(pollingRef.current!); reject(e); }
        }, 6000);
      });

      // Step 5: Finalize — build SRT + TTS
      setStep('generating');
      const finRes = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sarvamJobId: sarvamJobIdRef.current,
          outputStoragePath: outputStoragePathRef.current,
          videoUrl: videoUrlRef.current,
        }),
      });
      const finData = await finRes.json();
      if (!finRes.ok) throw new Error(finData.error || 'Finalize failed');

      setResults(finData);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred');
      setStep('error');
    }
  }

  const isRunning = ['downloading', 'transcribing', 'generating'].includes(step);
  const activeIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <Head>
        <title>OMI — Telugu → English Pipeline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-900 text-white p-6 max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">OMI Automation</h1>
          <p className="text-slate-400 mt-1">Telugu YouTube → English captions + dubbed audio</p>
        </div>

        {/* Input */}
        <div className="bg-slate-800 rounded-lg p-5 space-y-3">
          <label className="block text-sm font-semibold text-slate-300">YouTube URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={isRunning}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleProcess}
              disabled={isRunning || !youtubeUrl.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-semibold transition"
            >
              {isRunning ? 'Processing…' : 'Process'}
            </button>
          </div>
        </div>

        {/* Progress */}
        {step !== 'idle' && step !== 'error' && (
          <div className="bg-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wide">Progress</h2>
            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const isDone = step === 'done' || i < activeIdx;
                const isActive = s.key === step;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${isDone ? 'bg-green-500' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-700 text-slate-500'}`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div>
                      <p className={`font-medium ${isDone || isActive ? 'text-white' : 'text-slate-500'}`}>{s.label}</p>
                      <p className="text-xs text-slate-500">{s.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4">
            <p className="font-semibold text-red-400">Error</p>
            <p className="text-red-300 text-sm mt-1">{errorMsg}</p>
            <button
              onClick={() => setStep('idle')}
              className="mt-3 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {step === 'done' && results && (
          <div className="bg-slate-800 rounded-lg p-5 space-y-4">
            <h2 className="font-bold text-green-400">✓ Complete — {results.segmentCount} segments</h2>

            <div className="grid gap-3">
              {results.englishSrt && (
                <button
                  onClick={() => downloadText(results.englishSrt, 'english-captions.srt')}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-3 text-left transition"
                >
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="font-semibold">English Captions (SRT)</p>
                    <p className="text-xs text-slate-400">Time-stamped subtitle file</p>
                  </div>
                </button>
              )}

              {results.englishAudioBase64 && (
                <button
                  onClick={() => downloadBase64Audio(results.englishAudioBase64, 'english-dubbed.wav')}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-3 text-left transition"
                >
                  <span className="text-2xl">🔊</span>
                  <div>
                    <p className="font-semibold">English Dubbed Audio (WAV)</p>
                    <p className="text-xs text-slate-400">Sarvam TTS — English narration</p>
                  </div>
                </button>
              )}

              {results.videoUrl && (
                <a
                  href={results.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-3 text-left transition"
                >
                  <span className="text-2xl">🎬</span>
                  <div>
                    <p className="font-semibold">Original Video (MP4)</p>
                    <p className="text-xs text-slate-400">Open Apify CDN link</p>
                  </div>
                </a>
              )}
            </div>

            <button
              onClick={() => { setStep('idle'); setResults(null); setYoutubeUrl(''); }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Process another video
            </button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-slate-600 space-y-1">
          <p>Pipeline: Apify (YouTube download) → Sarvam STTT batch (Telugu → English) → Sarvam TTS</p>
          <p>Add APIFY_API_TOKEN and SARVAM_API_KEY to Vercel environment variables.</p>
        </div>

      </div>
    </>
  );
}
