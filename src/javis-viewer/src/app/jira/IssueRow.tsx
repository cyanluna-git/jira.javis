'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Tag } from 'lucide-react';
import { AdfRenderer } from '@/components/AdfRenderer';

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
  raw_data: any;
}

export default function IssueRow({ issue }: { issue: Issue }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const descriptionRaw = issue.raw_data?.fields?.description;
  const assignee = issue.raw_data?.fields?.assignee?.displayName || 'Unassigned';
  const reporter = issue.raw_data?.fields?.reporter?.displayName || 'Unknown';
  const labels = issue.raw_data?.fields?.labels || [];
  const priority = issue.raw_data?.fields?.priority?.name || 'None';
  const issueType = issue.raw_data?.fields?.issuetype?.name || 'Task';

  // Extract attachments
  const attachments = (issue.raw_data?.fields?.attachment || []).map((att: any) => ({
    id: att.id,
    filename: att.filename,
    content: att.content,
    thumbnail: att.thumbnail,
    mimeType: att.mimeType,
  }));

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
      >
        <td className="px-6 py-4 font-medium text-blue-600">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {issue.key}
          </div>
        </td>
        <td className="px-6 py-4 text-gray-800 font-medium">
          {issue.summary}
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {issue.status}
          </span>
        </td>
        <td className="px-6 py-4 text-gray-500">{issue.project}</td>
        <td className="px-6 py-4 text-gray-400 text-xs">
          {new Date(issue.created_at).toLocaleDateString()}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="space-y-4">
              {/* Header Info */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Type:</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {issueType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Priority:</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                    {priority}
                  </span>
                </div>
              </div>

              {/* People */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-700">Assignee:</span>
                  <span className="text-gray-600">{assignee}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-700">Reporter:</span>
                  <span className="text-gray-600">{reporter}</span>
                </div>
              </div>

              {/* Labels */}
              {labels.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="font-semibold text-gray-700">Labels:</span>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-700 text-sm">Description:</span>
                </div>
                <div className="text-sm text-gray-700 bg-white p-4 rounded border border-gray-200">
                  <AdfRenderer doc={descriptionRaw} attachments={attachments} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
