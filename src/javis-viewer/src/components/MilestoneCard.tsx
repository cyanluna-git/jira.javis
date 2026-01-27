'use client';

import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Pause,
  Calendar,
  ChevronDown,
  ChevronUp,
  GitBranch,
  LinkIcon,
} from 'lucide-react';
import type {
  MilestoneWithStreams,
  MilestoneStatus,
  RiskLevel,
  MILESTONE_STATUS_COLORS,
  RISK_LEVEL_COLORS,
} from '@/types/roadmap';
import StreamProgressBar from './StreamProgressBar';

interface Props {
  milestone: MilestoneWithStreams;
  onEdit?: () => void;
  showVisionTitle?: boolean;
}

const statusConfig: Record<MilestoneStatus, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  planned: { icon: <Clock className="w-4 h-4" />, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Planned' },
  in_progress: { icon: <Clock className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'In Progress' },
  completed: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  delayed: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Delayed' },
  blocked: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Blocked' },
};

const riskConfig: Record<RiskLevel, { color: string; bgColor: string }> = {
  low: { color: 'text-green-600', bgColor: 'bg-green-100' },
  medium: { color: 'text-amber-600', bgColor: 'bg-amber-100' },
  high: { color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function MilestoneCard({ milestone, onEdit, showVisionTitle = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusInfo = statusConfig[milestone.status];
  const riskInfo = riskConfig[milestone.risk_level];
  const progress = Number(milestone.progress_percent) || 0;

  const formatDateRange = () => {
    if (!milestone.target_start && !milestone.target_end) return null;
    const start = milestone.target_start
      ? new Date(milestone.target_start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : '';
    const end = milestone.target_end
      ? new Date(milestone.target_end).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : '';
    if (start && end) return `${start} - ${end}`;
    return start || end;
  };

  const dateRange = formatDateRange();

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Vision & Quarter */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {showVisionTitle && milestone.vision_title && (
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {milestone.vision_title}
                </span>
              )}
              {milestone.quarter && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {milestone.quarter}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
              {milestone.risk_level !== 'low' && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskInfo.bgColor} ${riskInfo.color}`}>
                  {milestone.risk_level.charAt(0).toUpperCase() + milestone.risk_level.slice(1)} Risk
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="font-semibold text-gray-900">{milestone.title}</h4>

            {/* Description */}
            {milestone.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{milestone.description}</p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {dateRange && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {dateRange}
                </span>
              )}
              {milestone.streams && milestone.streams.length > 0 && (
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {milestone.streams.length} streams
                </span>
              )}
              {milestone.epic_links && milestone.epic_links.length > 0 && (
                <span className="flex items-center gap-1">
                  <LinkIcon className="w-4 h-4" />
                  {milestone.epic_links.length} epics
                </span>
              )}
            </div>
          </div>

          {/* Progress & Toggle */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">{Math.round(progress)}%</div>
              <div className="text-xs text-gray-500">progress</div>
            </div>
            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                milestone.status === 'completed' ? 'bg-green-500' :
                milestone.status === 'blocked' ? 'bg-red-500' :
                milestone.status === 'delayed' ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Content: Streams & Epic Links */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Streams */}
          {milestone.streams && milestone.streams.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Execution Streams</div>
              <div className="space-y-2">
                {milestone.streams.map((stream) => (
                  <StreamProgressBar key={stream.id} stream={stream} />
                ))}
              </div>
            </div>
          )}

          {/* Epic Links */}
          {milestone.epic_links && milestone.epic_links.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Linked Epics</div>
              <div className="flex flex-wrap gap-2">
                {milestone.epic_links.map((link) => (
                  <span
                    key={link.id}
                    className="px-2 py-1 bg-white border border-gray-200 rounded text-sm font-mono text-blue-600 hover:bg-blue-50 cursor-pointer"
                  >
                    {link.epic_key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No Content */}
          {(!milestone.streams || milestone.streams.length === 0) &&
           (!milestone.epic_links || milestone.epic_links.length === 0) && (
            <div className="text-sm text-gray-400 text-center py-2">
              No streams or epics linked yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
