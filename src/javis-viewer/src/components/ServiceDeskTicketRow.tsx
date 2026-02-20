'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare } from 'lucide-react';
import { getStatusColor, getPriorityColor, type ServiceDeskTicket } from '@/types/service-desk';

interface Props {
  ticket: ServiceDeskTicket;
}

export default function ServiceDeskTicketRow({ ticket }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = getStatusColor(ticket.status);
  const priorityColor = ticket.priority ? getPriorityColor(ticket.priority) : '#6B7280';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Only render link if JIRA URL is configured
  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_URL;
  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${ticket.key}` : null;

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <button className="p-1 hover:bg-gray-200 rounded" aria-label={expanded ? 'Collapse row' : 'Expand row'}>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          {jiraUrl ? (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {ticket.key}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="font-medium text-gray-900">{ticket.key}</span>
          )}
        </td>
        <td className="px-4 py-3 max-w-md">
          <span className="line-clamp-1 text-gray-900" title={ticket.summary}>
            {ticket.summary}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-600">
            {ticket.reporter_display_name || '-'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-600">
            {ticket.assignee_display_name || '-'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {ticket.status}
          </span>
        </td>
        <td className="px-4 py-3">
          {ticket.priority && (
            <span
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${priorityColor}20`,
                color: priorityColor,
              }}
            >
              {ticket.priority}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {formatDate(ticket.created_at)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-4">
              {/* Top row: Details, Components, Link */}
              <div className="flex items-start justify-between gap-6">
                <div className="flex gap-8">
                  {/* Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Details</h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex">
                        <dt className="w-20 text-gray-500">Created:</dt>
                        <dd className="text-gray-700">{formatDate(ticket.created_at)}</dd>
                      </div>
                      <div className="flex">
                        <dt className="w-20 text-gray-500">Updated:</dt>
                        <dd className="text-gray-700">{formatDate(ticket.updated_at)}</dd>
                      </div>
                      {ticket.resolved_at && (
                        <div className="flex">
                          <dt className="w-20 text-gray-500">Resolved:</dt>
                          <dd className="text-gray-700">{formatDate(ticket.resolved_at)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Components */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Components</h4>
                    {ticket.components.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {ticket.components.map((comp) => (
                          <span
                            key={comp}
                            className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                          >
                            {comp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No components</span>
                    )}
                  </div>
                </div>

                {/* Jira Link Button */}
                {jiraUrl && (
                  <a
                    href={jiraUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Jira
                  </a>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                {ticket.description ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {ticket.description}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm italic">No description</span>
                )}
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments ({ticket.comments.length})
                </h4>
                {ticket.comments.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {ticket.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-white border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {comment.author_display_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(comment.created)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {comment.body}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm italic">No comments</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
