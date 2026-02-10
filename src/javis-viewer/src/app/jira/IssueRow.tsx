'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import IssueDetailModal from '@/components/IssueDetailModal';

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
  raw_data: any;
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
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}. ${month}. ${day}.`;
}

export default function IssueRow({ issue }: { issue: Issue }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <tr
        onClick={() => setShowModal(true)}
        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
      >
        <td className="px-6 py-4 font-medium text-blue-600">
          {issue.key}
        </td>
        <td className="px-6 py-4 text-gray-800 font-medium">
          {issue.summary}
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(issue.status)}`}>
            {issue.status}
          </span>
        </td>
        <td className="px-6 py-4 text-gray-500">{issue.project}</td>
        <td className="px-6 py-4 text-gray-400 text-xs">
          {formatDate(issue.created_at)}
        </td>
      </tr>
      {showModal && typeof document !== 'undefined' && createPortal(
        <IssueDetailModal
          issue={issue}
          onClose={() => setShowModal(false)}
        />,
        document.body
      )}
    </>
  );
}
