'use client';

import Link from 'next/link';
import {
  Target,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  Archive,
  ChevronRight,
  FileEdit,
  Box,
  Tag,
} from 'lucide-react';
import { useReadOnly } from '@/contexts/ReadOnlyContext';
import type { Vision, VisionStatus } from '@/types/roadmap';

interface VisionWithAggregates extends Vision {
  milestone_count: number;
  completed_milestones: number;
  overall_progress: number;
}

interface Props {
  vision: VisionWithAggregates;
  onClick?: () => void;
  onEdit?: () => void;
}

const statusConfig: Record<VisionStatus, { icon: React.ReactNode; color: string; label: string }> = {
  active: { icon: <Clock className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700', label: 'Active' },
  achieved: { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700', label: 'Achieved' },
  archived: { icon: <Archive className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600', label: 'Archived' },
};

export default function VisionCard({ vision, onClick, onEdit }: Props) {
  const isReadOnly = useReadOnly();
  const statusInfo = statusConfig[vision.status];
  const progressPercent = Math.round(vision.overall_progress);
  const northStarProgress = vision.north_star_target && vision.north_star_current
    ? Math.round((vision.north_star_current / vision.north_star_target) * 100)
    : null;

  const cardContent = (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {vision.project_key}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            </div>
            <h3 className="font-semibold text-lg text-gray-900 truncate">{vision.title}</h3>
            {vision.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{vision.description}</p>
            )}
            {/* Default Component & Labels */}
            {(vision.default_component || (vision.default_labels && vision.default_labels.length > 0)) && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {vision.default_component && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
                    <Box className="w-3 h-3" />
                    {vision.default_component}
                  </span>
                )}
                {vision.default_labels && vision.default_labels.map(label => (
                  <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                    <Tag className="w-3 h-3" />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isReadOnly && onEdit && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit Vision"
              >
                <FileEdit className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
          </div>
        </div>
      </div>

      {/* North Star Metric */}
      {vision.north_star_metric && (
        <div className="px-5 pb-4">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">North Star</span>
            </div>
            <div className="text-sm font-medium text-gray-900 mb-2">{vision.north_star_metric}</div>
            {northStarProgress !== null && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{vision.north_star_current?.toLocaleString()}</span>
                  <span>{vision.north_star_target?.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(northStarProgress, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-right text-indigo-600 mt-1 font-medium">
                  {northStarProgress}%
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Milestone Progress */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-gray-900">
                  {vision.completed_milestones}/{vision.milestone_count}
                </span>
              </div>
              <span className="text-xs text-gray-500">milestones</span>
            </div>

            {/* Target Date */}
            {vision.target_date && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{new Date(vision.target_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Overall Progress */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPercent >= 80 ? 'bg-green-500' :
                  progressPercent >= 50 ? 'bg-blue-500' :
                  progressPercent >= 25 ? 'bg-yellow-500' : 'bg-gray-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 w-10 text-right">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return cardContent;
  }

  return (
    <Link href={`/roadmap/${vision.id}`} className="block">
      {cardContent}
    </Link>
  );
}
