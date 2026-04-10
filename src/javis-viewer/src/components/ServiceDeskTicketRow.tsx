'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getStatusColor, getPriorityColor, type ServiceDeskTicket } from '@/types/service-desk';
import IssueDetailModal from '@/components/IssueDetailModal';

interface Props {
  ticket: ServiceDeskTicket;
}

export default function ServiceDeskTicketRow({ ticket }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [issueData, setIssueData] = useState<{ key: string; summary: string; status: string; project: string; raw_data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);

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

  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_URL;
  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${ticket.key}` : null;

  const handleRowClick = async () => {
    if (issueData) {
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${ticket.key}`);
      if (res.ok) {
        const data = await res.json();
        setIssueData(data);
        setShowModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={handleRowClick}
      >
        <td className="px-4 py-3">
          {loading ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          ) : null}
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
      {showModal && issueData && typeof document !== 'undefined' && createPortal(
        <IssueDetailModal
          issue={issueData}
          onClose={() => setShowModal(false)}
        />,
        document.body
      )}
    </>
  );
}
