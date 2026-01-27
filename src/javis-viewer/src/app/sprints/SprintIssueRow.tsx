'use client';

import { Bug, CheckSquare, Bookmark, Zap, HelpCircle, User, ExternalLink } from 'lucide-react';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issue: SprintIssue;
  onSelect?: (issue: SprintIssue) => void;
}

// Issue type icons
const issueTypeIcons: Record<string, React.ReactNode> = {
  bug: <Bug className="w-4 h-4 text-red-500" />,
  task: <CheckSquare className="w-4 h-4 text-blue-500" />,
  story: <Bookmark className="w-4 h-4 text-green-500" />,
  epic: <Zap className="w-4 h-4 text-purple-500" />,
  'sub-task': <CheckSquare className="w-4 h-4 text-blue-400" />,
};

// Status color mapping
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

export default function SprintIssueRow({ issue, onSelect }: Props) {
  const fields = issue.raw_data?.fields || {};

  const issueType = fields.issuetype?.name?.toLowerCase() || 'task';
  const storyPoints = fields.customfield_10016 || fields.storyPoints || null;
  const assignee = fields.assignee?.displayName || null;
  const components = fields.components || [];
  const fixVersions = fields.fixVersions || [];

  const icon = issueTypeIcons[issueType] || <HelpCircle className="w-4 h-4 text-gray-400" />;

  // Extract JIRA base URL from raw_data.self
  const getJiraUrl = (): string | null => {
    const selfUrl = issue.raw_data?.self;
    if (selfUrl) {
      try {
        const url = new URL(selfUrl);
        return `${url.origin}/browse/${issue.key}`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const jiraUrl = getJiraUrl();

  const handleClick = () => {
    if (onSelect) {
      onSelect(issue);
    }
  };

  const handleJiraLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <tr
      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
      onClick={handleClick}
    >
      {/* Type Icon */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center">
          {icon}
        </div>
      </td>

      {/* Key */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-blue-600">
            {issue.key}
          </span>
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJiraLinkClick}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="Open in JIRA"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            </a>
          )}
        </div>
      </td>

      {/* Summary with tags */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-gray-800 font-medium">{issue.summary}</span>
          <div className="flex flex-wrap gap-1">
            {/* Fix Versions */}
            {fixVersions.map((v: any) => (
              <span
                key={v.id}
                className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
              >
                {v.name}
              </span>
            ))}
            {/* Components */}
            {components.map((c: any) => (
              <span
                key={c.id}
                className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getStatusStyle(issue.status)}`}>
          {issue.status}
        </span>
      </td>

      {/* Story Points */}
      <td className="px-4 py-3 text-center">
        {storyPoints !== null ? (
          <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {storyPoints}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        {assignee ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-sm text-gray-700 truncate max-w-[120px]">{assignee}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Unassigned</span>
        )}
      </td>
    </tr>
  );
}
