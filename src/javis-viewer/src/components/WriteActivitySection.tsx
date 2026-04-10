'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, User } from 'lucide-react';

interface AuditEntry {
  id: string;
  created_at: string;
  app_user_key: string;
  app_user_name: string | null;
  app_user_email: string | null;
  action: string;
  entity_id: string;
  entity_type: string;
  product: string;
  payload: Record<string, unknown>;
}

interface Props {
  targetType: 'jira_issue' | 'confluence_page';
  targetId: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  issue_update: { label: 'Updated', color: 'bg-blue-100 text-blue-700' },
  issue_update_and_transition: { label: 'Updated + Transitioned', color: 'bg-purple-100 text-purple-700' },
  label_apply: { label: 'Labels Applied', color: 'bg-green-100 text-green-700' },
  restructure_apply: { label: 'Moved', color: 'bg-yellow-100 text-yellow-700' },
  archive_apply: { label: 'Archived', color: 'bg-gray-100 text-gray-600' },
};

export default function WriteActivitySection({ targetType, targetId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!targetId) return;

    setLoading(true);
    setError(false);

    fetch(`/api/audit/writes?target_type=${targetType}&target_id=${encodeURIComponent(targetId)}&limit=20`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data: { success: boolean; data: AuditEntry[] }) => {
        setEntries(data.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [targetType, targetId]);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Write Activity
      </h2>

      {loading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-gray-400 text-center py-4">Could not load activity</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No write activity recorded yet</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const badge = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'bg-gray-100 text-gray-600' };
            const displayName = entry.app_user_name ?? entry.app_user_email ?? entry.app_user_key;
            const changedFields = Array.isArray(entry.payload?.fields)
              ? (entry.payload.fields as string[])
              : [];

            return (
              <div key={entry.id} className="flex items-start gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    {changedFields.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {changedFields.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.created_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
