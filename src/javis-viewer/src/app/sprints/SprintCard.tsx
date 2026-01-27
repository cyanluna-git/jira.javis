'use client';

import { Calendar } from 'lucide-react';

interface Sprint {
  id: number;
  board_id: number;
  name: string;
  state: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Props {
  sprint: Sprint;
  isSelected: boolean;
  onClick: () => void;
}

export default function SprintCard({ sprint, isSelected, onClick }: Props) {
  const stateColors: Record<string, string> = {
    active: 'border-green-400 bg-green-50',
    future: 'border-blue-400 bg-blue-50',
    closed: 'border-gray-300 bg-gray-50',
  };

  const stateBadgeColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    future: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-64 p-4 rounded-xl border-2 text-left transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : `${stateColors[sprint.state] || stateColors.closed} hover:shadow-md`
        }
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
          {sprint.name}
        </h3>
        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
          stateBadgeColors[sprint.state] || stateBadgeColors.closed
        }`}>
          {sprint.state}
        </span>
      </div>

      {/* Dates */}
      {(sprint.start_date || sprint.end_date) && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <Calendar className="w-3 h-3" />
          <span>
            {sprint.start_date
              ? new Date(sprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '?'}
            {' - '}
            {sprint.end_date
              ? new Date(sprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '?'}
          </span>
        </div>
      )}

      {/* Goal preview */}
      {sprint.goal && (
        <p className="text-xs text-gray-500 line-clamp-2">
          {sprint.goal}
        </p>
      )}
    </button>
  );
}
