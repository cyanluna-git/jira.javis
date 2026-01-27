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
  Plus,
  X,
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
  onEpicLinked?: () => void;
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

interface EpicSuggestion {
  key: string;
  summary: string;
  status: string;
  similarity?: number;
}

export default function MilestoneCard({ milestone, onEdit, showVisionTitle = false, onEpicLinked }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showAddEpic, setShowAddEpic] = useState(false);
  const [newEpicKey, setNewEpicKey] = useState('');
  const [linking, setLinking] = useState(false);
  const [epicSuggestions, setEpicSuggestions] = useState<EpicSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const statusInfo = statusConfig[milestone.status];
  const riskInfo = riskConfig[milestone.risk_level];

  // Fetch epic suggestions when search term changes
  const searchEpics = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setEpicSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        limit: '10',
      });
      // Include milestone title for AI matching
      if (milestone.title) {
        params.set('vision_text', milestone.title + ' ' + (milestone.description || ''));
      }

      const res = await fetch(`/api/roadmap/epics?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEpicSuggestions(data);
      }
    } catch (error) {
      console.error('Error searching epics:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleEpicKeyChange = (value: string) => {
    setNewEpicKey(value.toUpperCase());
    searchEpics(value);
  };

  const selectEpic = (epic: EpicSuggestion) => {
    setNewEpicKey(epic.key);
    setEpicSuggestions([]);
  };

  const handleAddEpic = async () => {
    if (!newEpicKey.trim()) return;

    setLinking(true);
    try {
      const res = await fetch(`/api/roadmap/milestones/${milestone.id}/epics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic_key: newEpicKey.toUpperCase() }),
      });

      if (res.ok) {
        setNewEpicKey('');
        setShowAddEpic(false);
        setEpicSuggestions([]);
        onEpicLinked?.();
      } else {
        alert('Failed to link epic');
      }
    } catch (error) {
      console.error('Error linking epic:', error);
    } finally {
      setLinking(false);
    }
  };

  const handleRemoveEpic = async (epicKey: string) => {
    if (!confirm(`Remove ${epicKey} from this milestone?`)) return;

    try {
      const res = await fetch(`/api/roadmap/milestones/${milestone.id}/epics?epic_key=${epicKey}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onEpicLinked?.();
      }
    } catch (error) {
      console.error('Error removing epic:', error);
    }
  };
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-500 uppercase">Linked Epics</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddEpic(!showAddEpic);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Epic
              </button>
            </div>

            {/* Add Epic Form */}
            {showAddEpic && (
              <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newEpicKey}
                      onChange={(e) => handleEpicKeyChange(e.target.value)}
                      placeholder="EUV- 입력하여 검색..."
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                    />
                    {/* Suggestions Dropdown */}
                    {epicSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {epicSuggestions.map((epic) => (
                          <button
                            key={epic.key}
                            onClick={() => selectEpic(epic)}
                            className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-indigo-600">{epic.key}</span>
                                {epic.similarity !== undefined && epic.similarity > 0.1 && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                    {Math.round(epic.similarity * 100)}% 일치
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{epic.summary}</div>
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              epic.status === 'Done' ? 'bg-green-100 text-green-700' :
                              epic.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {epic.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {loadingSuggestions && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAddEpic}
                    disabled={linking || !newEpicKey.trim()}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {linking ? '...' : 'Link'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEpic(false);
                      setNewEpicKey('');
                      setEpicSuggestions([]);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Epic Key를 입력하거나 검색어로 찾기
                </div>
              </div>
            )}

            {/* Epic List */}
            {milestone.epic_links && milestone.epic_links.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {milestone.epic_links.map((link) => (
                  <span
                    key={link.id}
                    className="group px-2 py-1 bg-white border border-gray-200 rounded text-sm font-mono text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                  >
                    {link.epic_key}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveEpic(link.epic_key);
                      }}
                      className="hidden group-hover:block text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : !showAddEpic && (
              <div className="text-sm text-gray-400">No epics linked</div>
            )}
          </div>

          {/* No Streams Message */}
          {(!milestone.streams || milestone.streams.length === 0) && (
            <div className="text-sm text-gray-400 mt-2">No streams defined</div>
          )}
        </div>
      )}
    </div>
  );
}
