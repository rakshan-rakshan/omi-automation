import React from 'react';

interface ResultsProps {
  teluguText?: string;
  englishText?: string;
  videoUrl?: string;
  duration?: number;
  fileSize?: number;
  mode: number;
}

export default function Results({
  teluguText,
  englishText,
  videoUrl,
  duration,
  fileSize,
  mode,
}: ResultsProps) {
  return (
    <div className="space-y-6">
      {teluguText && (
        <div className="p-4 bg-slate-700/50 rounded-lg">
          <h4 className="font-semibold text-white mb-2">🇮🇳 Telugu Transcript</h4>
          <p className="text-slate-300 text-sm max-h-40 overflow-y-auto break-words">
            {teluguText}
          </p>
        </div>
      )}

      {englishText && (
        <div className="p-4 bg-slate-700/50 rounded-lg">
          <h4 className="font-semibold text-white mb-2">🇬🇧 English Transcript</h4>
          <p className="text-slate-300 text-sm max-h-40 overflow-y-auto break-words">
            {englishText}
          </p>
        </div>
      )}

      {videoUrl && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <h4 className="font-semibold text-white mb-2">✅ Video Ready</h4>
          <p className="text-slate-300 text-sm mb-3">Your dubbed video is ready to download</p>
          <a
            href={videoUrl}
            download
            className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
          >
            📥 Download Video
          </a>
          {fileSize && (
            <p className="text-xs text-slate-400 mt-2">
              File size: {(fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      )}

      {duration && (
        <div className="p-4 bg-slate-700/50 rounded-lg">
          <p className="text-slate-300 text-sm">
            <span className="font-semibold">⏱️ Duration:</span> {Math.round(duration)} seconds
          </p>
        </div>
      )}
    </div>
  );
}
