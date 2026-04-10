'use client';

import { ExternalLink, Calendar, Tag, FileText, ChevronRight } from 'lucide-react';
import { ConfluenceRenderer } from '@/components/ConfluenceRenderer';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';

interface Props {
  page: ConfluencePage;
  breadcrumbs: ConfluenceBreadcrumb[];
}

export default function ConfluenceFullPage({ page, breadcrumbs }: Props) {
  const labels = page.labels || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 mb-2 text-sm text-gray-500 flex-wrap">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <span className="hover:text-gray-700 truncate max-w-[200px]" title={crumb.title}>
                    {crumb.title}
                  </span>
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
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

          {labels.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              {labels.slice(0, 8).map((label) => (
                <span key={label} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {label}
                </span>
              ))}
              {labels.length > 8 && (
                <span className="text-xs text-gray-500">+{labels.length - 8} more</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {page.body_storage ? (
            <ConfluenceRenderer content={page.body_storage} pageId={page.id} />
          ) : (
            <div className="text-gray-400 text-center py-16">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No content available</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="flex items-center justify-between text-sm text-gray-500 bg-white rounded-xl border border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            {page.created_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Created: {formatDate(page.created_at)}</span>
              </div>
            )}
            {page.last_synced_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Updated: {formatDate(page.last_synced_at)}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400">ID: {page.id}</span>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
