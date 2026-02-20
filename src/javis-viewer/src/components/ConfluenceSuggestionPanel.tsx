'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  GitMerge,
  RefreshCw,
  Move,
  Tag,
  Archive,
  Scissors,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  AISuggestionWithPages,
  SuggestionType,
  SuggestionStatus,
  SUGGESTION_TYPE_LABELS,
  SUGGESTION_TYPE_COLORS,
} from '@/types/confluence';

interface Props {
  compact?: boolean;
}

const suggestionTypeIcons: Record<SuggestionType, React.ReactNode> = {
  merge: <GitMerge className="w-4 h-4" />,
  update: <RefreshCw className="w-4 h-4" />,
  restructure: <Move className="w-4 h-4" />,
  label: <Tag className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
  split: <Scissors className="w-4 h-4" />,
};

const suggestionTypeLabels: Record<SuggestionType, string> = {
  merge: '병합',
  update: '업데이트',
  restructure: '재구조화',
  label: '라벨링',
  archive: '아카이브',
  split: '분할',
};

const suggestionTypeColors: Record<SuggestionType, { bg: string; text: string; border: string }> = {
  merge: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  update: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  restructure: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  label: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  archive: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  split: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
};

const statusConfig: Record<SuggestionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '대기중', color: 'text-amber-600', icon: <AlertTriangle className="w-3 h-3" /> },
  approved: { label: '승인됨', color: 'text-green-600', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: '거절됨', color: 'text-red-600', icon: <XCircle className="w-3 h-3" /> },
  applied: { label: '적용됨', color: 'text-blue-600', icon: <CheckCircle className="w-3 h-3" /> },
  expired: { label: '만료됨', color: 'text-gray-500', icon: <XCircle className="w-3 h-3" /> },
};

interface SuggestionCounts {
  total: number;
  by_type: Record<SuggestionType, number>;
  by_status: Record<SuggestionStatus, number>;
}

export default function ConfluenceSuggestionPanel({ compact = false }: Props) {
  const [suggestions, setSuggestions] = useState<AISuggestionWithPages[]>([]);
  const [counts, setCounts] = useState<SuggestionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [expanded, setExpanded] = useState(true);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', compact ? '5' : '20');

      const res = await fetch(`/api/confluence/suggestions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setCounts({
          total: data.total || 0,
          by_type: data.by_type || {},
          by_status: data.by_status || {},
        });
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSuggestionStatus = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/confluence/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchSuggestions();
      }
    } catch (error) {
      console.error('Error updating suggestion:', error);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filterType, filterStatus]);

  const pendingCount = counts?.by_status?.pending || 0;

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Header */}
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pendingCount > 0 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
              <Sparkles className={`w-5 h-5 ${pendingCount > 0 ? 'text-indigo-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI 문서 제안</h3>
              <p className="text-sm text-gray-500">
                {pendingCount > 0 ? (
                  <span className="text-indigo-600 font-medium">{pendingCount}개 대기중</span>
                ) : (
                  <span className="text-gray-500">제안 없음</span>
                )}
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {expanded && (
          <div className="border-t border-gray-100">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                로딩 중...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500">대기 중인 제안이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {suggestions.slice(0, 5).map(suggestion => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApprove={() => updateSuggestionStatus(suggestion.id, 'approve')}
                    onReject={() => updateSuggestionStatus(suggestion.id, 'reject')}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full panel view
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter Bar */}
      <div className="p-3 border-b border-gray-200 bg-white space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">모든 유형</option>
            {Object.entries(suggestionTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">모든 상태</option>
            <option value="pending">대기중</option>
            <option value="approved">승인됨</option>
            <option value="rejected">거절됨</option>
            <option value="applied">적용됨</option>
          </select>
        </div>

        {/* Type counts */}
        {counts && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(counts.by_type).map(([type, count]) => (
              count > 0 && (
                <span
                  key={type}
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1',
                    suggestionTypeColors[type as SuggestionType].bg,
                    suggestionTypeColors[type as SuggestionType].text
                  )}
                >
                  {suggestionTypeIcons[type as SuggestionType]}
                  {count}
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            로딩 중...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-6 text-center">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">제안이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">AI 분석을 실행하여 제안을 받으세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {suggestions.map(suggestion => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onApprove={() => updateSuggestionStatus(suggestion.id, 'approve')}
                onReject={() => updateSuggestionStatus(suggestion.id, 'reject')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: AISuggestionWithPages;
  onApprove: () => void;
  onReject: () => void;
}

function SuggestionItem({ suggestion, onApprove, onReject }: SuggestionItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const typeConfig = suggestionTypeColors[suggestion.suggestion_type];
  const status = statusConfig[suggestion.status];

  return (
    <div
      className={clsx(
        'p-3 hover:bg-gray-50 cursor-pointer',
        suggestion.status === 'pending' && typeConfig.bg
      )}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={clsx('p-1.5 rounded', typeConfig.bg, typeConfig.text)}>
          {suggestionTypeIcons[suggestion.suggestion_type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded font-medium border',
              typeConfig.bg, typeConfig.text, typeConfig.border
            )}>
              {suggestionTypeLabels[suggestion.suggestion_type]}
            </span>
            <span className={clsx('text-xs flex items-center gap-1', status.color)}>
              {status.icon}
              {status.label}
            </span>
            {suggestion.confidence_score && (
              <span className="text-xs text-gray-400">
                {Math.round(suggestion.confidence_score * 100)}%
              </span>
            )}
          </div>

          {/* Target pages */}
          <div className="text-sm text-gray-700">
            {suggestion.target_pages?.slice(0, 2).map((page, idx) => (
              <span key={page.id}>
                {idx > 0 && ', '}
                <span className="font-medium">{page.title}</span>
              </span>
            ))}
            {suggestion.target_pages && suggestion.target_pages.length > 2 && (
              <span className="text-gray-500"> +{suggestion.target_pages.length - 2}개</span>
            )}
          </div>

          {/* AI Reasoning */}
          {suggestion.ai_reasoning && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {suggestion.ai_reasoning}
            </p>
          )}

          {/* Actions */}
          {suggestion.status === 'pending' && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                승인
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                거절
              </button>
            </div>
          )}

          {/* Details */}
          {showDetails && (
            <div className="mt-3 p-2 bg-white rounded border border-gray-200 text-xs">
              <div className="text-gray-500 mb-2">
                생성: {new Date(suggestion.created_at).toLocaleString('ko-KR')}
              </div>
              <div className="space-y-1">
                {suggestion.target_pages?.map(page => (
                  <a
                    key={page.id}
                    href={page.web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {page.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
              {suggestion.suggested_action && (
                <pre className="mt-2 p-2 bg-gray-50 rounded text-[10px] overflow-x-auto">
                  {JSON.stringify(suggestion.suggested_action, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
