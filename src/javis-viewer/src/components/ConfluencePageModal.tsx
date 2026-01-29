'use client';

import { useEffect, useCallback } from 'react';
import { X, ExternalLink, Calendar, Tag, FileText, ChevronRight } from 'lucide-react';
import { ConfluenceRenderer } from './ConfluenceRenderer';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';

interface Props {
  page: ConfluencePage;
  breadcrumbs?: ConfluenceBreadcrumb[];
  onClose: () => void;
}

export default function ConfluencePageModal({ page, breadcrumbs = [], onClose }: Props) {
  const labels = page.labels || [];
  const createdAt = page.created_at;
  const updatedAt = page.last_synced_at;

  // Handle Escape key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confluence-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 min-w-0">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 mb-2 text-sm text-gray-500 flex-wrap">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={crumb.id} className="flex items-center gap-1">
                    <span className="hover:text-gray-700 truncate max-w-[150px]" title={crumb.title}>
                      {crumb.title}
                    </span>
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    )}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" aria-hidden="true" />
              <h2 id="confluence-modal-title" className="text-xl font-bold text-gray-900 truncate">{page.title}</h2>
              {page.web_url && (
                <a
                  href={page.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Confluence에서 열기
                </a>
              )}
            </div>
            {/* Labels */}
            {labels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                {labels.slice(0, 5).map((label) => (
                  <span
                    key={label}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                  >
                    {label}
                  </span>
                ))}
                {labels.length > 5 && (
                  <span className="text-xs text-gray-500">+{labels.length - 5} more</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors ml-4"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {page.body_storage ? (
              <ConfluenceRenderer content={page.body_storage} pageId={page.id} />
            ) : (
              <div className="text-gray-400 text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No content available</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Metadata */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {createdAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created: {formatDate(createdAt)}</span>
              </div>
            )}
            {updatedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Updated: {formatDate(updatedAt)}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400">
            ID: {page.id}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
