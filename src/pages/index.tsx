import React, { useState, useRef } from 'react';
import Head from 'next/head';

type Step = 'idle' | 'uploading' | 'transcribing' | 'generating' | 'done' | 'error';
type Mode = 'youtube' | 'upload';

const STEPS: { key: Step; label: string; detail: string }[] = [
  { key: 'uploading', label: 'Uploading', detail: 'Sending audio to Sarvam batch job' },
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

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<{
    englishSrt: string;
    englishAudioBase64: string;
    videoUrl: string;
    segmentCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sarvamJobIdRef = useRef<string | null>(null);
  const outputStoragePathRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  function reset() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep('idle');
    setErrorMsg('');
    setResults(null);
    sarvamJobIdRef.current = null;
    outputStoragePathRef.current = null;
    videoUrlRef.current = null;
  }

  async function pollAndFinalize(jobId: string, outputPath: string, videoUrl: string | null) {
    sarvamJobIdRef.current = jobId;
    outputStoragePathRef.current = outputPath;
    videoUrlRef.current = videoUrl;

    setStep('transcribing');
    await new Promise<void>((resolve, reject) => {
      pollingRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/sarvam-status?jobId=${jobId}`);
          const d = await r.json();
          if (!r.ok) { clearInterval(pollingRef.current!); reject(new Error(d.error)); return; }
          if (d.status === 'Completed') { clearInterval(pollingRef.current!); resolve(); }
          else if (d.status === 'Failed') { clearInterval(pollingRef.current!); reject(new Error('Sarvam transcription failed')); }
        } catch (e: any) { clearInterval(pollingRef.current!); reject(e); }
      }, 6000);
    });

    setStep('generating');
    const finRes = await fetch('/api/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sarvamJobId: jobId, outputStoragePath: outputPath, videoUrl }),
    });
    const finData = await finRes.json();
    if (!finRes.ok) throw new Error(finData.error || 'Finalize failed');
    setResults(finData);
    setStep('done');
  }

  async function handleYoutubeProcess() {
    if (!youtubeUrl.trim()) return;
    reset();
    setStep('uploading');
    try {
      const startRes = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to get download URL');

      const sr = await fetch('/api/sarvam-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: startData.audioUrl }),
      });
      const sd = await sr.json();
      if (!sr.ok) throw new Error(sd.error || 'Failed to start transcription');

      await pollAndFinalize(sd.sarvamJobId, sd.outputStoragePath, startData.videoUrl || null);
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred');
      setStep('error');
    }
  }

  async function handleFileProcess() {
    if (!selectedFile) return;
    reset();
    setStep('uploading');
    try {
      const buffer = await selectedFile.arrayBuffer();
      const sr = await fetch('/api/upload-start', {
        method: 'POST',
        headers: { 'Content-Type': selectedFile.type || 'audio/mpeg' },
        body: buffer,
      });
      const sd = await sr.json();
      if (!sr.ok) throw new Error(sd.error || 'Failed to upload file');

      await pollAndFinalize(sd.sarvamJobId, sd.outputStoragePath, null);
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred');
      setStep('error');
    }
  }

  const isRunning = ['uploading', 'transcribing', 'generating'].includes(step);
  const activeIdx = STEPS.findIndex((s) => s.key === step);
  const canSubmit = mode === 'youtube' ? !!youtubeUrl.trim() : !!selectedFile;

  return (
    <>
      <Head>
        <title>OMI — Telugu → English Pipeline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-900 text-white p-6 max-w-2xl mx-auto space-y-8">

        <div>
          <h1 className="text-3xl font-bold">OMI Automation</h1>
          <p className="text-slate-400 mt-1">Telugu audio → English captions + dubbed audio</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => { setMode('youtube'); reset(); }}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === 'youtube' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              YouTube URL
            </button>
            <button
              onClick={() => { setMode('upload'); reset(); }}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Upload File
            </button>
          </div>

          {mode === 'youtube' ? (
            <div className="space-y-2">
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
                  onClick={handleYoutubeProcess}
                  disabled={isRunning || !youtubeUrl.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-semibold transition"
                >
                  {isRunning ? 'Processing…' : 'Process'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-300">Audio or Video File</label>
              <div
                onClick={() => !isRunning && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition
                  ${isRunning ? 'opacity-50 cursor-not-allowed border-slate-600' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-700/30'}`}
              >
                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-sm text-slate-400 mt-1">{fmtBytes(selectedFile.size)} · {selectedFile.type || 'unknown type'}</p>
                    {selectedFile.size > 4 * 1024 * 1024 && (
                      <p className="text-xs text-yellow-400 mt-2">File is over 4 MB — may hit Vercel size limit. Use a shorter clip if it fails.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400">Click to select audio or video</p>
                    <p className="text-xs text-slate-500 mt-1">MP3, MP4, WAV, OGG, WebM · max ~4 MB on Vercel Hobby</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <button
                onClick={handleFileProcess}
                disabled={isRunning || !selectedFile}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-semibold transition"
              >
                {isRunning ? 'Processing…' : 'Process File'}
              </button>
            </div>
          )}
        </div>

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

        {step === 'done' && results && (
          <div className="bg-slate-800 rounded-lg p-5 space-y-4">
            <h2 className="font-bold text-green-400">Complete — {results.segmentCount} segments</h2>
            <div className="grid gap-3">
              {results.englishSrt && (
                <button
                  onClick={() => downloadText(results.englishSrt, 'english-captions.srt')}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-3 text-left transition"
                >
                  <span className="text-xl">SRT</span>
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
                  <span className="text-xl">WAV</span>
                  <div>
                    <p className="font-semibold">English Dubbed Audio (WAV)</p>
                    <p className="text-xs text-slate-400">Sarvam TTS — English narration</p>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => { reset(); setYoutubeUrl(''); setSelectedFile(null); }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Process another
            </button>
          </div>
        )}

        <div className="text-xs text-slate-600 space-y-1">
          <p>Pipeline: audio source → Sarvam STTT batch (Telugu → English) → Sarvam TTS</p>
          <p>Requires SARVAM_API_KEY in environment variables.</p>
        </div>
      </div>
    </>
  );
}
