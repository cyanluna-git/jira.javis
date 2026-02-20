'use client';

import { FileText, Calendar, Tag } from 'lucide-react';
import type { ConfluencePage } from '@/types/confluence';

interface Props {
  page: ConfluencePage;
  sprintLabel: string;
  onClick: () => void;
}

// Project labels to highlight (excluding the sprint label)
const PROJECT_LABELS = ['euvgen4', 'unify', 'oqcdigitalization', 'oqc', 'euv', 'scaled'];

export default function SprintDocumentCard({ page, sprintLabel, onClick }: Props) {
  const labels = page.labels || [];

  // Filter out the sprint label and show project-related labels
  const displayLabels = labels
    .filter(label => label.toLowerCase() !== sprintLabel.toLowerCase())
    .filter(label => PROJECT_LABELS.some(p => label.toLowerCase().includes(p)))
    .slice(0, 3);

  const createdAt = page.created_at
    ? new Date(page.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group w-full"
    >
      {/* Icon and Title */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <h4 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
          {page.title}
        </h4>
      </div>

      {/* Labels */}
      {displayLabels.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Tag className="w-3 h-3 text-gray-400" />
          {displayLabels.map(label => (
            <span
              key={label}
              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
            >
              {label}
            </span>
          ))}
          {labels.length > displayLabels.length + 1 && (
            <span className="text-xs text-gray-400">
              +{labels.length - displayLabels.length - 1}
            </span>
          )}
        </div>
      )}

      {/* Created Date */}
      {createdAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>{createdAt}</span>
        </div>
      )}
    </button>
  );
}
