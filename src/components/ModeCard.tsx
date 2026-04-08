import React from 'react';

interface ModeCardProps {
  mode: number;
  title: string;
  description: string;
  icon: string;
  features: string[];
  isSelected: boolean;
  onSelect: () => void;
}

export default function ModeCard({
  mode,
  title,
  description,
  icon,
  features,
  isSelected,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`p-6 rounded-lg border-2 transition-all text-left w-full ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-white">Mode {mode}: {title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-green-400">✓</span>
            {feature}
          </div>
        ))}
      </div>
    </button>
  );
}
