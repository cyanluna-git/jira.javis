'use client';

import type { Stream, StreamCategory, STREAM_CATEGORY_COLORS } from '@/types/roadmap';

interface Props {
  stream: Stream;
  showLabel?: boolean;
}

const categoryConfig: Record<StreamCategory, { color: string; bgColor: string; label: string }> = {
  backend: { color: 'bg-purple-500', bgColor: 'bg-purple-100', label: 'Backend' },
  frontend: { color: 'bg-blue-500', bgColor: 'bg-blue-100', label: 'Frontend' },
  infra: { color: 'bg-gray-500', bgColor: 'bg-gray-100', label: 'Infra' },
  design: { color: 'bg-pink-500', bgColor: 'bg-pink-100', label: 'Design' },
  qa: { color: 'bg-green-500', bgColor: 'bg-green-100', label: 'QA' },
};

export default function StreamProgressBar({ stream, showLabel = true }: Props) {
  const progress = Number(stream.progress_percent) || 0;
  const config = categoryConfig[stream.category] || categoryConfig.backend;

  return (
    <div className="flex items-center gap-3">
      {/* Category Badge */}
      <div
        className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} text-gray-700 w-20 text-center flex-shrink-0`}
      >
        {config.label}
      </div>

      {/* Stream Name */}
      {showLabel && (
        <div className="flex-shrink-0 w-32 text-sm text-gray-700 truncate" title={stream.name}>
          {stream.name}
        </div>
      )}

      {/* Progress Bar */}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${stream.color ? '' : config.color}`}
          style={{
            width: `${progress}%`,
            backgroundColor: stream.color || undefined,
          }}
        />
      </div>

      {/* Percentage */}
      <div className="w-12 text-right text-sm font-medium text-gray-600">
        {Math.round(progress)}%
      </div>
    </div>
  );
}
