'use client';

import { X, User, Tag, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { AdfRenderer } from './AdfRenderer';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issue: SprintIssue;
  onClose: () => void;
}

export default function IssueDetailModal({ issue, onClose }: Props) {
  const fields = issue.raw_data?.fields || {};
  const description = fields.description;
  const labels = fields.labels || [];
  const priority = fields.priority;
  const assignee = fields.assignee;
  const reporter = fields.reporter;
  const created = fields.created;
  const updated = fields.updated;
  const comments = fields.comment?.comments || [];
  const attachments = fields.attachment || [];

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
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-blue-600 font-medium">{issue.key}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(issue.status)}`}>
                {issue.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 truncate">{issue.summary}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Description</h3>
                <div className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-200">
                  <AdfRenderer doc={description} attachments={attachments} />
                </div>
              </section>

              {/* Comments */}
              {comments.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({comments.length})
                  </h3>
                  <div className="space-y-4">
                    {comments.slice(0, 10).map((comment: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-sm text-gray-900">
                            {comment.author?.displayName || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {comment.created ? formatDate(comment.created) : ''}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          <AdfRenderer doc={comment.body} />
                        </div>
                      </div>
                    ))}
                    {comments.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        + {comments.length - 10} more comments
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Priority */}
              {priority && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Priority</div>
                    <div className="font-medium text-gray-900">{priority.name}</div>
                  </div>
                </div>
              )}

              {/* Assignee */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Assignee</div>
                  <div className="font-medium text-gray-900">
                    {assignee?.displayName || 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* Reporter */}
              {reporter && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500">Reporter</div>
                    <div className="font-medium text-gray-900">{reporter.displayName}</div>
                  </div>
                </div>
              )}

              {/* Labels */}
              {labels.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">Labels</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {labels.map((label: string) => (
                      <span
                        key={label}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">Dates</span>
                </div>
                {created && (
                  <div className="text-sm">
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="text-gray-900">{formatDate(created)}</span>
                  </div>
                )}
                {updated && (
                  <div className="text-sm">
                    <span className="text-gray-500">Updated:</span>{' '}
                    <span className="text-gray-900">{formatDate(updated)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'closed' || s === 'resolved') {
    return 'bg-green-100 text-green-700';
  }
  if (s === 'in progress' || s === 'in review') {
    return 'bg-blue-100 text-blue-700';
  }
  if (s === 'testing' || s === 'qa') {
    return 'bg-yellow-100 text-yellow-700';
  }
  return 'bg-gray-100 text-gray-600';
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
