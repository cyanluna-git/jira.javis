'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import IssueDetailModal from '@/components/IssueDetailModal';
import type { SprintIssue } from '@/types/sprint';

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
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
  const [detailIssue, setDetailIssue] = useState<SprintIssue | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const openIssueModal = async () => {
    setShowModal(true);

    if (detailIssue || isLoadingDetail) {
      return;
    }

    setIsLoadingDetail(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/issues/${issue.key}`);
      if (!response.ok) {
        throw new Error(`Failed to load issue ${issue.key}`);
      }

      const issueDetail = await response.json() as SprintIssue;
      setDetailIssue(issueDetail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to load issue details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <>
      <tr
        onClick={() => void openIssueModal()}
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
        detailIssue ? (
          <IssueDetailModal
            issue={detailIssue}
            onClose={() => setShowModal(false)}
          />
        ) : (
          <IssueDetailStateModal
            issueKey={issue.key}
            isLoading={isLoadingDetail}
            error={detailError}
            onClose={() => setShowModal(false)}
            onRetry={() => void openIssueModal()}
          />
        ),
        document.body
      )}
    </>
  );
}

function IssueDetailStateModal({
  issueKey,
  isLoading,
  error,
  onClose,
  onRetry,
}: {
  issueKey: string;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{issueKey}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading issue details...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error || 'Issue details could not be loaded.'}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
