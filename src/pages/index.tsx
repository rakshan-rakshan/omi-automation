import React, { useState } from 'react';
import ModeCard from '@/components/ModeCard';
import Results from '@/components/Results';
import Head from 'next/head';

const MODES = [
  {
    num: 1,
    title: 'Transcribe',
    description: 'Download audio and transcribe to English',
    icon: '🎤',
    features: [
      'Download audio from YouTube',
      'Convert Telugu audio to English text',
      'Sarvam STT integration',
    ],
    endpoint: '/api/transcribe',
  },
  {
    num: 2,
    title: 'Translate',
    description: 'Get bilingual transcripts',
    icon: '🔤',
    features: [
      'Download audio from YouTube',
      'Transcribe Telugu audio',
      'Translate to English',
      'Get both transcripts',
    ],
    endpoint: '/api/translate',
  },
  {
    num: 3,
    title: 'Full Dub',
    description: 'Complete English dubbed video',
    icon: '🎬',
    features: [
      'Download audio from YouTube',
      'Transcribe Telugu audio',
      'Translate to English',
      'Generate English audio',
      'Download dubbed MP4',
    ],
    endpoint: '/api/dub',
  },
];

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<number>(1);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleProcess = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const mode = MODES.find((m) => m.num === selectedMode);
      if (!mode) throw new Error('Invalid mode selected');

      console.log(`Processing with Mode ${selectedMode}:`, youtubeUrl);

      const response = await fetch(mode.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      setResults(data.data);
      console.log('✅ Results:', data.data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setYoutubeUrl('');
    setResults(null);
    setError('');
  };

  return (
    <>
      <Head>
        <title>OMI Automation - YouTube Dubbing Pipeline</title>
        <meta name="description" content="Convert Telugu YouTube videos to English automatically" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="space-y-8">
        {/* Mode Selection */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Select Processing Mode</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {MODES.map((mode) => (
              <ModeCard
                key={mode.num}
                mode={mode.num}
                title={mode.title}
                description={mode.description}
                icon={mode.icon}
                features={mode.features}
                isSelected={selectedMode === mode.num}
                onSelect={() => setSelectedMode(mode.num)}
              />
            ))}
          </div>
        </div>

        {/* URL Input */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <label className="block text-white font-semibold mb-3">
            🔗 YouTube URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-700 text-white placeholder-slate-400 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleProcess}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold rounded-lg transition"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Processing...
                </span>
              ) : (
                '▶ Process'
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">
              <span className="font-semibold">❌ Error:</span> {error}
            </p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                ✅ Results (Mode {selectedMode})
              </h3>
              <button
                onClick={handleClear}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition"
              >
                Clear
              </button>
            </div>
            <Results
              teluguText={results.teluguTranscript}
              englishText={results.englishTranscript}
              videoUrl={results.videoUrl}
              duration={results.duration}
              fileSize={results.fileSize}
              mode={selectedMode}
            />
          </div>
        )}

        {/* Info Section */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3">ℹ️ About This Pipeline</h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>✅ Downloads audio directly from YouTube</li>
            <li>✅ Transcribes Telugu audio to English text using Sarvam STT</li>
            <li>✅ Translates text using Sarvam Neural Machine Translation</li>
            <li>✅ Generates English audio using Sarvam Text-to-Speech</li>
            <li>✅ Merges dubbed audio back into video with FFmpeg</li>
            <li>✅ Supports MP4, MKV, and WebM formats</li>
            <li>✅ Process 6600+ ministry videos at scale</li>
          </ul>
        </div>
      </div>
    </>
  );
}
