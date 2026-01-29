'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Circle,
  LinkIcon,
  ExternalLink,
} from 'lucide-react';
import type { EpicWithIssues, IssueBasic } from '@/types/roadmap';

interface EpicIssueTreeProps {
  epic: EpicWithIssues;
  onLinkToMilestone?: (epicKey: string) => void;
  jiraUrl?: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  Done: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600' },
  Closed: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600' },
  Resolved: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600' },
  'In Progress': { icon: <Clock className="w-4 h-4" />, color: 'text-blue-600' },
  'In Review': { icon: <Clock className="w-4 h-4" />, color: 'text-purple-600' },
  'To Do': { icon: <Circle className="w-4 h-4" />, color: 'text-gray-400' },
  Open: { icon: <Circle className="w-4 h-4" />, color: 'text-gray-400' },
};

const getStatusConfig = (status: string) => {
  return statusConfig[status] || { icon: <Circle className="w-4 h-4" />, color: 'text-gray-400' };
};

export default function EpicIssueTree({ epic, onLinkToMilestone, jiraUrl }: EpicIssueTreeProps) {
  const [expanded, setExpanded] = useState(false);
  const { stats } = epic;

  const progressColor = stats.progress_percent >= 80
    ? 'bg-green-500'
    : stats.progress_percent >= 50
    ? 'bg-blue-500'
    : stats.progress_percent >= 25
    ? 'bg-yellow-500'
    : 'bg-gray-300';

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Epic Header */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand Toggle */}
        <button className="p-0.5 hover:bg-gray-200 rounded">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {/* Epic Key */}
        <a
          href={jiraUrl ? `${jiraUrl}/browse/${epic.key}` : `#${epic.key}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
        >
          {epic.key}
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Epic Summary */}
        <span className="flex-1 text-sm text-gray-700 truncate">{epic.summary}</span>

        {/* Epic Status */}
        <span className={`text-xs px-2 py-0.5 rounded ${
          epic.status === 'Done' ? 'bg-green-100 text-green-700' :
          epic.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {epic.status}
        </span>

        {/* Progress */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all`}
              style={{ width: `${stats.progress_percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-12 text-right">
            {stats.done}/{stats.total}
          </span>
        </div>

        {/* Milestone Badge or Link Button */}
        {epic.milestone_title ? (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 max-w-[100px] truncate">
            {epic.milestone_title}
          </span>
        ) : onLinkToMilestone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLinkToMilestone(epic.key);
            }}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            Link
          </button>
        )}
      </div>

      {/* Child Issues */}
      {expanded && epic.issues.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="divide-y divide-gray-100">
            {epic.issues.map((issue) => (
              <IssueRow key={issue.key} issue={issue} jiraUrl={jiraUrl} />
            ))}
          </div>
        </div>
      )}

      {expanded && epic.issues.length === 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
          No child issues
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue, jiraUrl }: { issue: IssueBasic; jiraUrl?: string }) {
  const statusInfo = getStatusConfig(issue.status);

  return (
    <div className="px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors">
      {/* Indent */}
      <div className="w-6" />

      {/* Status Icon */}
      <span className={statusInfo.color}>{statusInfo.icon}</span>

      {/* Issue Key */}
      <a
        href={jiraUrl ? `${jiraUrl}/browse/${issue.key}` : `#${issue.key}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-indigo-600 hover:underline"
      >
        {issue.key}
      </a>

      {/* Issue Type */}
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        issue.type === 'Story' ? 'bg-green-100 text-green-700' :
        issue.type === 'Bug' ? 'bg-red-100 text-red-700' :
        issue.type === 'Task' ? 'bg-blue-100 text-blue-700' :
        'bg-gray-100 text-gray-600'
      }`}>
        {issue.type}
      </span>

      {/* Summary */}
      <span className="flex-1 text-sm text-gray-600 truncate">{issue.summary}</span>

      {/* Assignee */}
      {issue.assignee && (
        <span className="text-xs text-gray-400 truncate max-w-[100px]">{issue.assignee}</span>
      )}

      {/* Status */}
      <span className={`text-xs ${statusInfo.color}`}>{issue.status}</span>
    </div>
  );
}
