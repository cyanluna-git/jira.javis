'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Play, Check, X, RefreshCw, Clock, AlertCircle,
  ChevronDown, ChevronUp, RotateCcw, Trash2
} from 'lucide-react';

interface Operation {
  id: string;
  operation_type: string;
  target_type: string;
  target_ids: string[];
  status: string;
  error_message: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
  executed_at: string | null;
}

interface StatusCounts {
  pending: number;
  approved: number;
  executing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface Props {
  initialOperations: Operation[];
  initialCounts: StatusCounts;
}

type StatusFilter = 'all' | keyof StatusCounts;

export default function OperationsContent({ initialOperations, initialCounts }: Props) {
  const [operations, setOperations] = useState(initialOperations);
  const [counts, setCounts] = useState(initialCounts);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const filteredOperations = useMemo(() => {
    if (statusFilter === 'all') return operations;
    return operations.filter(op => op.status === statusFilter);
  }, [operations, statusFilter]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/operations');
      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations);
        setCounts({
          pending: data.counts.pending || 0,
          approved: data.counts.approved || 0,
          executing: data.counts.executing || 0,
          completed: data.counts.completed || 0,
          failed: data.counts.failed || 0,
          cancelled: data.counts.cancelled || 0,
        });
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const performAction = useCallback(async (operationId: string, action: string) => {
    setLoading(prev => ({ ...prev, [operationId]: true }));
    try {
      const response = await fetch(`/api/operations/${operationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await refreshData();
      } else {
        const data = await response.json();
        alert(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Action failed');
    } finally {
      setLoading(prev => ({ ...prev, [operationId]: false }));
    }
  }, [refreshData]);

  const deleteOperation = useCallback(async (operationId: string) => {
    if (!confirm('Delete this operation?')) return;

    setLoading(prev => ({ ...prev, [operationId]: true }));
    try {
      const response = await fetch(`/api/operations/${operationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refreshData();
      } else {
        const data = await response.json();
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Delete failed');
    } finally {
      setLoading(prev => ({ ...prev, [operationId]: false }));
    }
  }, [refreshData]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      executing: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return styles[status] || 'bg-gray-100 text-gray-600';
  };

  const getOperationTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      merge: 'M',
      restructure: 'R',
      summarize: 'S',
      update_field: 'U',
      bulk_transition: 'B',
      link_issues: 'L',
      archive: 'A',
      move: 'V',
    };
    return icons[type] || '?';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-lg border transition-colors ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-2xl font-bold">{totalCount}</div>
          <div className="text-sm opacity-80">All</div>
        </button>

        {(['pending', 'approved', 'executing', 'completed', 'failed', 'cancelled'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`p-4 rounded-lg border transition-colors ${
              statusFilter === status
                ? 'bg-gray-900 text-white border-gray-900'
                : `bg-white border-gray-200 hover:bg-gray-50 ${getStatusBadge(status).replace('bg-', 'hover:bg-').split(' ')[0]}`
            }`}
          >
            <div className="text-2xl font-bold">{counts[status]}</div>
            <div className="text-sm opacity-80 capitalize">{status}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          Showing {filteredOperations.length} operation{filteredOperations.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Operations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredOperations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No operations found</p>
            <p className="text-sm mt-1">
              {statusFilter === 'all'
                ? 'Create operations using the API or AI agent'
                : `No ${statusFilter} operations`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredOperations.map(op => (
              <div key={op.id} className="hover:bg-gray-50 transition-colors">
                {/* Main Row */}
                <div className="flex items-center p-4 gap-4">
                  {/* Type Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    op.target_type === 'jira' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {getOperationTypeIcon(op.operation_type)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 capitalize">
                        {op.operation_type.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(op.status)}`}>
                        {op.status}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {op.target_type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {op.target_ids.length} target{op.target_ids.length !== 1 ? 's' : ''}
                      {op.target_ids.length <= 3 && (
                        <span className="ml-2">
                          ({op.target_ids.join(', ')})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="text-right text-sm text-gray-500 hidden md:block">
                    <div>Created: {formatDate(op.created_at)}</div>
                    {op.executed_at && <div>Executed: {formatDate(op.executed_at)}</div>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {op.status === 'pending' && (
                      <>
                        <button
                          onClick={() => performAction(op.id, 'approve')}
                          disabled={loading[op.id]}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => performAction(op.id, 'cancel')}
                          disabled={loading[op.id]}
                          className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteOperation(op.id)}
                          disabled={loading[op.id]}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {op.status === 'approved' && (
                      <>
                        <button
                          onClick={() => performAction(op.id, 'cancel')}
                          disabled={loading[op.id]}
                          className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                          <Play className="w-4 h-4 inline mr-1" />
                          Run executor
                        </div>
                      </>
                    )}

                    {op.status === 'completed' && (
                      <button
                        onClick={() => performAction(op.id, 'rollback')}
                        disabled={loading[op.id]}
                        className="p-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                        title="Rollback"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}

                    {op.status === 'cancelled' && (
                      <button
                        onClick={() => deleteOperation(op.id)}
                        disabled={loading[op.id]}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {loading[op.id] && (
                      <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    )}

                    {/* Expand Toggle */}
                    <button
                      onClick={() => setExpandedId(expandedId === op.id ? null : op.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {expandedId === op.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === op.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Targets */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Targets</h4>
                        <div className="flex flex-wrap gap-1">
                          {op.target_ids.map((id, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700"
                            >
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                        <dl className="text-sm space-y-1">
                          <div className="flex gap-2">
                            <dt className="text-gray-500">ID:</dt>
                            <dd className="text-gray-700 font-mono text-xs">{op.id}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-gray-500">Created by:</dt>
                            <dd className="text-gray-700">{op.created_by || '-'}</dd>
                          </div>
                          {op.approved_by && (
                            <div className="flex gap-2">
                              <dt className="text-gray-500">Approved by:</dt>
                              <dd className="text-gray-700">{op.approved_by}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {/* Error Message */}
                    {op.error_message && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700">{op.error_message}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">How to execute operations</h3>
        <p className="text-sm text-blue-700">
          Approved operations are executed by running the executor script:
        </p>
        <code className="block mt-2 p-2 bg-white rounded text-sm font-mono text-gray-800">
          python scripts/execute_operations.py
        </code>
        <p className="text-sm text-blue-700 mt-2">
          Use <code className="bg-white px-1 rounded">--dry-run</code> to preview without making changes.
        </p>
      </div>
    </>
  );
}
