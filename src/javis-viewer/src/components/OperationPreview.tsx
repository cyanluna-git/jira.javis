'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Code, FileText } from 'lucide-react';

interface PreviewData {
  merged_content?: string;
  diff_html?: string;
  summary?: string;
  changes?: Array<{
    field: string;
    old_value: unknown;
    new_value: unknown;
  }>;
}

interface OperationData {
  id: string;
  operation_type: string;
  target_type: string;
  target_ids: string[];
  preview_data?: PreviewData;
  ai_response?: Record<string, unknown>;
}

interface Props {
  operation: OperationData;
  onClose: () => void;
}

type ViewMode = 'preview' | 'diff' | 'raw';

export default function OperationPreview({ operation, onClose }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

  const preview = operation.preview_data || {};
  const hasMultipleTargets = operation.target_ids.length > 1;

  const renderPreviewContent = () => {
    if (!preview) {
      return (
        <div className="p-8 text-center text-gray-500">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No preview data available</p>
          <p className="text-sm mt-1">Generate a preview using the API</p>
        </div>
      );
    }

    switch (operation.operation_type) {
      case 'merge':
        return renderMergePreview();
      case 'update_field':
        return renderFieldUpdatePreview();
      case 'bulk_transition':
        return renderTransitionPreview();
      case 'summarize':
        return renderSummaryPreview();
      default:
        return renderGenericPreview();
    }
  };

  const renderMergePreview = () => {
    if (viewMode === 'diff' && preview.diff_html) {
      return (
        <div
          className="prose prose-sm max-w-none p-4"
          dangerouslySetInnerHTML={{ __html: preview.diff_html }}
        />
      );
    }

    if (viewMode === 'raw') {
      return (
        <pre className="p-4 text-sm font-mono overflow-auto whitespace-pre-wrap">
          {preview.merged_content || 'No content'}
        </pre>
      );
    }

    // Preview mode - render as HTML if it looks like HTML
    const content = preview.merged_content || '';
    if (content.includes('<') && content.includes('>')) {
      return (
        <div
          className="prose prose-sm max-w-none p-4"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    return (
      <div className="p-4 text-gray-700 whitespace-pre-wrap">
        {content || 'No merged content available'}
      </div>
    );
  };

  const renderFieldUpdatePreview = () => {
    const changes = preview.changes || [];

    if (changes.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          No field changes to preview
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        {changes.map((change, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="font-medium text-gray-700">{change.field}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-1">Before</div>
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded">
                  {formatValue(change.old_value)}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-1">After</div>
                <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
                  {formatValue(change.new_value)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTransitionPreview = () => {
    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {operation.target_ids.map((id, idx) => (
            <div
              key={idx}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3"
            >
              <span className="font-medium text-blue-700">{id}</span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                New Status
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSummaryPreview = () => {
    const summary = preview.summary || '';

    return (
      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">AI Summary</h3>
          <p className="text-blue-800 whitespace-pre-wrap">{summary || 'No summary available'}</p>
        </div>
      </div>
    );
  };

  const renderGenericPreview = () => {
    if (viewMode === 'raw' || !preview) {
      return (
        <pre className="p-4 text-sm font-mono overflow-auto">
          {JSON.stringify(preview, null, 2)}
        </pre>
      );
    }

    return (
      <div className="p-4">
        <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto">
          {JSON.stringify(preview, null, 2)}
        </pre>
      </div>
    );
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-900 capitalize">
                {operation.operation_type.replace('_', ' ')} Preview
              </h2>
              <p className="text-sm text-gray-500">
                {operation.target_ids.length} target{operation.target_ids.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Preview
              </button>
              {preview.diff_html && (
                <button
                  onClick={() => setViewMode('diff')}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === 'diff'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Diff
                </button>
              )}
              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-4 h-4 inline mr-1" />
                Raw
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Target Navigator (for multiple targets) */}
        {hasMultipleTargets && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setCurrentTargetIndex(Math.max(0, currentTargetIndex - 1))}
              disabled={currentTargetIndex === 0}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-700">
              <span className="font-medium">{operation.target_ids[currentTargetIndex]}</span>
              <span className="text-gray-400 ml-2">
                ({currentTargetIndex + 1} of {operation.target_ids.length})
              </span>
            </span>
            <button
              onClick={() => setCurrentTargetIndex(Math.min(operation.target_ids.length - 1, currentTargetIndex + 1))}
              disabled={currentTargetIndex === operation.target_ids.length - 1}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {renderPreviewContent()}
        </div>

        {/* AI Response (if available) */}
        {operation.ai_response && viewMode === 'raw' && (
          <div className="border-t border-gray-200">
            <div className="px-4 py-2 bg-purple-50 border-b border-purple-200">
              <span className="text-sm font-medium text-purple-700">AI Response</span>
            </div>
            <pre className="p-4 text-xs font-mono overflow-auto max-h-48 bg-gray-50">
              {JSON.stringify(operation.ai_response, null, 2)}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
