'use client';

import { User, Tag, Calendar, MessageSquare, AlertCircle, ExternalLink, Paperclip, Link2 } from 'lucide-react';
import WriteActivitySection from '@/components/WriteActivitySection';
import { AdfRenderer } from '@/components/AdfRenderer';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issue: SprintIssue;
  jiraBaseUrl: string | null;
}

export default function IssueFullPage({ issue, jiraBaseUrl }: Props) {
  const fields = issue.raw_data?.fields || {};
  const description = fields.description;
  const labels: string[] = fields.labels || [];
  const priority = fields.priority;
  const assignee = fields.assignee;
  const reporter = fields.reporter;
  const created = fields.created;
  const updated = fields.updated;
  const comments: unknown[] = fields.comment?.comments || [];
  const attachments: Array<{ id: string; filename: string; content: string; mimeType: string; thumbnail?: string; size?: number }> =
    fields.attachment || [];
  const subtasks: unknown[] = fields.subtasks || [];
  const issueLinks: unknown[] = fields.issuelinks || [];

  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-blue-600 font-medium text-lg">{issue.key}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(issue.status)}`}>
              {issue.status}
            </span>
            {jiraUrl && (
              <a
                href={jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                JIRA에서 열기
              </a>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{issue.summary}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Description</h2>
              <div className="text-sm text-gray-700">
                <AdfRenderer doc={description} attachments={attachments} issueKey={issue.key} />
              </div>
            </section>

            {/* Attachments */}
            {attachments.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({attachments.length})
                </h2>
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{att.filename || 'Unknown file'}</span>
                        {att.size != null && (
                          <span className="text-xs text-gray-500 shrink-0">{formatFileSize(att.size)}</span>
                        )}
                      </div>
                      {att.content && (
                        <a
                          href={att.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 shrink-0 ml-2"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Subtasks ({subtasks.length})
                </h2>
                <div className="space-y-2">
                  {(subtasks as Array<{ key?: string; fields?: { summary?: string; status?: { name?: string } } }>).map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-blue-600 shrink-0">{sub.key}</span>
                      <span className="text-sm text-gray-700 truncate flex-1">{sub.fields?.summary}</span>
                      {sub.fields?.status?.name && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getStatusStyle(sub.fields.status.name)}`}>
                          {sub.fields.status.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Linked Issues */}
            {issueLinks.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Linked Issues ({issueLinks.length})
                </h2>
                <div className="space-y-2">
                  {(issueLinks as Array<{
                    type?: { name?: string; inward?: string; outward?: string };
                    inwardIssue?: { key?: string; fields?: { summary?: string; status?: { name?: string } } };
                    outwardIssue?: { key?: string; fields?: { summary?: string; status?: { name?: string } } };
                  }>).map((link, idx) => {
                    const linked = link.inwardIssue || link.outwardIssue;
                    const relation = link.inwardIssue ? link.type?.inward : link.type?.outward;
                    if (!linked) return null;
                    return (
                      <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                        {relation && (
                          <span className="text-xs text-gray-500 shrink-0 w-24">{relation}</span>
                        )}
                        <span className="text-sm font-medium text-blue-600 shrink-0">{linked.key}</span>
                        <span className="text-sm text-gray-700 truncate flex-1">{linked.fields?.summary}</span>
                        {linked.fields?.status?.name && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getStatusStyle(linked.fields.status.name)}`}>
                            {linked.fields.status.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments ({comments.length})
                </h2>
                <div className="space-y-4">
                  {(comments as Array<{
                    author?: { displayName?: string; avatarUrls?: Record<string, string> };
                    created?: string;
                    body?: unknown;
                  }>).map((comment, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {comment.author?.avatarUrls?.['24x24'] ? (
                          <img
                            src={comment.author.avatarUrls['24x24']}
                            alt={comment.author.displayName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                        )}
                        <span className="font-medium text-sm text-gray-900">
                          {comment.author?.displayName || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {comment.created ? formatDate(comment.created) : ''}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <AdfRenderer doc={comment.body} attachments={attachments} issueKey={issue.key} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <WriteActivitySection targetType="jira_issue" targetId={issue.key} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {priority && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Priority</div>
                  <div className="font-medium text-gray-900">{(priority as { name?: string }).name}</div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              {(assignee as { avatarUrls?: Record<string, string>; displayName?: string } | null)?.avatarUrls?.['32x32'] ? (
                <img
                  src={(assignee as { avatarUrls: Record<string, string> }).avatarUrls['32x32']}
                  alt={(assignee as { displayName?: string }).displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Assignee</div>
                <div className="font-medium text-gray-900">
                  {(assignee as { displayName?: string } | null)?.displayName || 'Unassigned'}
                </div>
              </div>
            </div>

            {reporter && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                {(reporter as { avatarUrls?: Record<string, string> }).avatarUrls?.['32x32'] ? (
                  <img
                    src={(reporter as { avatarUrls: Record<string, string> }).avatarUrls['32x32']}
                    alt={(reporter as { displayName?: string }).displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500">Reporter</div>
                  <div className="font-medium text-gray-900">
                    {(reporter as { displayName?: string }).displayName}
                  </div>
                </div>
              </div>
            )}

            {labels.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">Labels</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {labels.map((label) => (
                    <span key={label} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
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
  );
}

function getStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'closed' || s === 'resolved') return 'bg-green-100 text-green-700';
  if (s === 'in progress' || s === 'in review') return 'bg-blue-100 text-blue-700';
  if (s === 'testing' || s === 'qa') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
