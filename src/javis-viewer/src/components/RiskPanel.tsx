'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  XCircle,
  Users,
  GitBranch,
  TrendingDown,
  Clock,
  CheckCircle,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type {
  Risk,
  RiskWithContext,
  RiskType,
  RiskLevel,
  RiskStatus,
  RISK_TYPE_LABELS,
  RISK_STATUS_LABELS,
} from '@/types/roadmap';

interface RiskSummary {
  total_risks: number;
  open_risks: number;
  by_severity: Record<RiskLevel, number>;
}

interface Props {
  visionId?: string;
  onRiskClick?: (risk: RiskWithContext) => void;
}

const riskTypeIcons: Record<RiskType, React.ReactNode> = {
  delay: <Clock className="w-4 h-4" />,
  blocker: <XCircle className="w-4 h-4" />,
  resource_conflict: <Users className="w-4 h-4" />,
  dependency_block: <GitBranch className="w-4 h-4" />,
  velocity_drop: <TrendingDown className="w-4 h-4" />,
};

const riskTypeLabels: Record<RiskType, string> = {
  delay: '일정 지연',
  blocker: '차단 이슈',
  resource_conflict: '리소스 충돌',
  dependency_block: '의존성 차단',
  velocity_drop: '속도 저하',
};

const severityConfig: Record<RiskLevel, { color: string; bgColor: string; borderColor: string }> = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  medium: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  low: { color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
};

const statusConfig: Record<RiskStatus, { label: string; color: string }> = {
  open: { label: '열림', color: 'text-red-600' },
  acknowledged: { label: '인지됨', color: 'text-amber-600' },
  mitigated: { label: '완화됨', color: 'text-blue-600' },
  resolved: { label: '해결됨', color: 'text-green-600' },
  false_positive: { label: '오탐', color: 'text-gray-600' },
};

export default function RiskPanel({ visionId, onRiskClick }: Props) {
  const [risks, setRisks] = useState<RiskWithContext[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('open');

  const fetchRisks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '20');

      const res = await fetch(`/api/roadmap/risks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRisks(data.risks);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching risks:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/roadmap/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision_id: visionId }),
      });

      if (res.ok) {
        const result = await res.json();
        console.log('Risk analysis result:', result);
        fetchRisks();
      }
    } catch (error) {
      console.error('Error running risk analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRiskStatus = async (riskId: string, status: RiskStatus, note?: string) => {
    try {
      const res = await fetch('/api/roadmap/risks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: riskId, status, resolution_note: note }),
      });

      if (res.ok) {
        fetchRisks();
      }
    } catch (error) {
      console.error('Error updating risk:', error);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, [filterStatus]);

  const openCount = summary?.open_risks || 0;
  const criticalCount = summary?.by_severity.critical || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${criticalCount > 0 ? 'bg-red-100' : openCount > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600' : openCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI 리스크 감지</h3>
            <p className="text-sm text-gray-500">
              {openCount > 0 ? (
                <>
                  <span className="text-red-600 font-medium">{openCount}개 리스크</span> 감지됨
                  {criticalCount > 0 && (
                    <span className="text-red-600 ml-1">({criticalCount}개 긴급)</span>
                  )}
                </>
              ) : (
                <span className="text-green-600">리스크 없음</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runAnalysis();
            }}
            disabled={analyzing}
            className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1"
          >
            {analyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            분석 실행
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Summary Bar */}
          {summary && openCount > 0 && (
            <div className="px-4 py-2 bg-gray-50 flex items-center gap-4 text-xs">
              {Object.entries(summary.by_severity).map(([sev, count]) => (
                count > 0 && (
                  <span key={sev} className={`flex items-center gap-1 ${severityConfig[sev as RiskLevel].color}`}>
                    <span className={`w-2 h-2 rounded-full ${sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`} />
                    {sev === 'critical' ? '긴급' : sev === 'high' ? '높음' : sev === 'medium' ? '중간' : '낮음'}: {count}
                  </span>
                )
              ))}
            </div>
          )}

          {/* Filter */}
          <div className="px-4 py-2 border-b border-gray-100">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체</option>
              <option value="open">열림</option>
              <option value="acknowledged">인지됨</option>
              <option value="mitigated">완화됨</option>
              <option value="resolved">해결됨</option>
            </select>
          </div>

          {/* Risk List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                로딩 중...
              </div>
            ) : risks.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500">감지된 리스크가 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">분석 실행 버튼을 눌러 검사하세요</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {risks.map((risk) => (
                  <RiskItem
                    key={risk.id}
                    risk={risk}
                    onStatusChange={updateRiskStatus}
                    onClick={() => onRiskClick?.(risk)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RiskItemProps {
  risk: RiskWithContext;
  onStatusChange: (id: string, status: RiskStatus, note?: string) => void;
  onClick?: () => void;
}

function RiskItem({ risk, onStatusChange, onClick }: RiskItemProps) {
  const [showActions, setShowActions] = useState(false);
  const severity = severityConfig[risk.severity];
  const status = statusConfig[risk.status];

  return (
    <div
      className={`p-3 hover:bg-gray-50 cursor-pointer ${severity.bgColor}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-1.5 rounded ${severity.bgColor} ${severity.color}`}>
          {riskTypeIcons[risk.risk_type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${severity.bgColor} ${severity.color} border ${severity.borderColor}`}>
              {risk.severity === 'critical' ? '긴급' : risk.severity === 'high' ? '높음' : risk.severity === 'medium' ? '중간' : '낮음'}
            </span>
            <span className="text-xs text-gray-500">
              {riskTypeLabels[risk.risk_type]}
            </span>
            {risk.epic_key && (
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                {risk.epic_key}
              </span>
            )}
          </div>

          <h4 className="text-sm font-medium text-gray-900 truncate">{risk.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{risk.description}</p>

          {/* AI Suggestion */}
          {risk.ai_suggestion && (
            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
              <div className="flex items-center gap-1 text-xs text-indigo-600 mb-1">
                <Sparkles className="w-3 h-3" />
                AI 제안
              </div>
              <p className="text-xs text-gray-600">{risk.ai_suggestion}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {risk.milestone_title}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${status.color}`}>{status.label}</span>
              {risk.status === 'open' && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(!showActions);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    조치
                  </button>
                  {showActions && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(risk.id, 'acknowledged');
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                      >
                        인지함
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(risk.id, 'mitigated', '조치 진행 중');
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                      >
                        완화 중
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(risk.id, 'resolved', '해결 완료');
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                      >
                        해결됨
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(risk.id, 'false_positive', '오탐으로 판단');
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-500"
                      >
                        오탐
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
