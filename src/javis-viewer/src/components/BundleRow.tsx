'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink, FileText, CheckCircle2, Clock, Circle } from 'lucide-react';
import type { Bundle } from '@/types/bundle';
import type { SprintIssue } from '@/types/sprint';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';
import { BUNDLE_STATUS_COLORS, GENERATION_COLORS } from '@/types/bundle';
import { determineBundleStatus, mapStatusToCategory } from '@/lib/bundle';
import IssueDetailModal from './IssueDetailModal';
import ConfluencePageModal from './ConfluencePageModal';

interface Props {
  bundle: Bundle;
}

const JIRA_BASE_URL = process.env.NEXT_PUBLIC_JIRA_URL || 'https://ac-avi.atlassian.net';

// Status colors for issues
const ISSUE_STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  done: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  inProgress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
  todo: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Circle },
};

export default function BundleRow({ bundle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<SprintIssue | null>(null);
  const [loadingIssueKey, setLoadingIssueKey] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<ConfluencePage | null>(null);
  const [pageBreadcrumbs, setPageBreadcrumbs] = useState<ConfluenceBreadcrumb[]>([]);
  const [loadingPageId, setLoadingPageId] = useState<string | null>(null);

  const status = determineBundleStatus(bundle.status, bundle.progress);
  const statusColor = BUNDLE_STATUS_COLORS[status];
  const generationColor = GENERATION_COLORS[bundle.generation];

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  // Fetch issue details and show modal
  const handleIssueClick = async (issueKey: string) => {
    setLoadingIssueKey(issueKey);
    try {
      const res = await fetch(`/api/issues/${issueKey}`);
      if (!res.ok) throw new Error('Failed to fetch issue');
      const issue: SprintIssue = await res.json();
      setSelectedIssue(issue);
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      setLoadingIssueKey(null);
    }
  };

  // Fetch Confluence page details and show modal
  const handleDocumentClick = async (docId: string, docUrl: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoadingPageId(docId);
    try {
      const res = await fetch(`/api/confluence/page/${docId}`);
      if (!res.ok) throw new Error('Failed to fetch page');
      const data: { page: ConfluencePage; breadcrumbs: ConfluenceBreadcrumb[] } = await res.json();
      setSelectedPage(data.page);
      setPageBreadcrumbs(data.breadcrumbs || []);
    } catch (error) {
      console.error('Error fetching confluence page:', error);
      // Fallback: open in new tab if modal loading fails
      if (docUrl) {
        window.open(docUrl, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setLoadingPageId(null);
    }
  };

  return (
    <>
      {/* Main Row */}
      <div
        className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Bundle Name */}
        <div className="col-span-4 flex items-center gap-3">
          <button
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{bundle.summary}</span>
              <a
                href={`${JIRA_BASE_URL}/browse/${bundle.key}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{bundle.key}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${generationColor}20`,
                  color: generationColor,
                }}
              >
                {bundle.generation === 'gen2' ? 'Gen2/2+' : 'Gen3/3+'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar - Stacked */}
        <div className="col-span-3 flex items-center">
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                {bundle.progress.total > 0 && (
                  <>
                    {/* Done - Green */}
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(bundle.progress.done / bundle.progress.total) * 100}%` }}
                    />
                    {/* In Progress - Blue */}
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(bundle.progress.inProgress / bundle.progress.total) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 w-12 text-right">
                {bundle.progress.percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Issues Count */}
        <div className="col-span-2 flex items-center justify-center">
          <span className="text-sm text-gray-700">
            <span className="font-medium text-green-600">{bundle.progress.done}</span>
            <span className="text-gray-400"> / </span>
            <span>{bundle.progress.total}</span>
          </span>
        </div>

        {/* Documents Count */}
        <div className="col-span-1 flex items-center justify-center">
          {bundle.documents.length > 0 ? (
            <span className="flex items-center gap-1 text-sm text-blue-600">
              <FileText className="w-4 h-4" />
              {bundle.documents.length}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>

        {/* Status Badge */}
        <div className="col-span-2 flex items-center justify-center">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-4">
          <div className="ml-8 space-y-4">
            {/* Issues Section */}
            {bundle.issues.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Issues ({bundle.issues.length})
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Key</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Summary</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Assignee</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bundle.issues.map((issue) => {
                        const category = mapStatusToCategory(issue.status);
                        const statusStyle = ISSUE_STATUS_COLORS[category];
                        const StatusIcon = statusStyle.icon;
                        const isLoading = loadingIssueKey === issue.key;

                        return (
                          <tr
                            key={issue.key}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => handleIssueClick(issue.key)}
                          >
                            <td className="px-3 py-2">
                              <span className={`font-medium ${isLoading ? 'text-gray-400' : 'text-blue-600'}`}>
                                {isLoading ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                                    {issue.key}
                                  </span>
                                ) : (
                                  issue.key
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-700 max-w-md truncate">
                              {issue.summary}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {issue.issueType}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {issue.assignee || <span className="text-gray-400">Unassigned</span>}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {issue.status}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Issues */}
            {bundle.issues.length === 0 && (
              <div className="text-sm text-gray-500">
                No issues linked to this bundle version.
              </div>
            )}

            {/* Documents Section */}
            {bundle.documents.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Related Documents ({bundle.documents.length})
                </div>
                <div className="space-y-1">
                  {bundle.documents.map((doc) => {
                    const isLoading = loadingPageId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                        onClick={(e) => handleDocumentClick(doc.id, doc.url, e)}
                      >
                        {isLoading ? (
                          <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500" />
                        )}
                        <span className={`text-sm flex-1 ${isLoading ? 'text-gray-400' : 'text-gray-700'}`}>
                          {doc.title}
                        </span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Confluence에서 열기"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Documents Note */}
            {bundle.documents.length === 0 && bundle.issues.length > 0 && (
              <div className="text-sm text-gray-400">
                No related Confluence documents found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {/* Confluence Page Modal */}
      {selectedPage && (
        <ConfluencePageModal
          page={selectedPage}
          breadcrumbs={pageBreadcrumbs}
          onClose={() => {
            setSelectedPage(null);
            setPageBreadcrumbs([]);
          }}
        />
      )}
    </>
  );
}
