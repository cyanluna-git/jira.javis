'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAccessContext } from '@/contexts/ReadOnlyContext';

type AtlassianProduct = 'jira' | 'confluence';
type AccessReason =
  | 'write_enabled'
  | 'global_read_only'
  | 'authentication_required'
  | 'identity_unresolved'
  | 'general_write_not_enabled'
  | 'jira_write_not_enabled'
  | 'confluence_write_not_enabled';

interface AtlassianStatusResponse {
  configured: boolean;
  connected: boolean;
  requestedScopes: string[];
  user: {
    id: string | null;
    email: string | null;
    name: string | null;
    username: string | null;
  } | null;
  connection: {
    account: {
      id: string | null;
      email: string | null;
      name: string | null;
      picture: string | null;
    };
    site: {
      id: string | null;
      url: string | null;
      name: string | null;
    };
    capabilities: {
      jiraWrite: boolean;
      confluenceWrite: boolean;
    };
  } | null;
}

const ACCESS_REASON_LABELS: Record<AccessReason, string> = {
  write_enabled: 'Write access available',
  global_read_only: '이 서버는 현재 전역 읽기 전용입니다.',
  authentication_required: '로그인 세션이 필요합니다.',
  identity_unresolved: '로그인 세션은 있지만 사용자 식별이 되지 않았습니다.',
  general_write_not_enabled: '현재 계정은 이 영역의 write 권한이 없습니다.',
  jira_write_not_enabled: '현재 계정은 Jira write 권한이 없습니다.',
  confluence_write_not_enabled: '현재 계정은 Confluence write 권한이 없습니다.',
};

export function useAtlassianConnection(product: AtlassianProduct) {
  const access = useAccessContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<AtlassianStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const resolvedReturnTo = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/atlassian/status', {
        cache: 'no-store',
      });
      const payload = await response.json();
      setStatus(payload);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = () => {
    window.location.assign(`/api/auth/atlassian/connect?returnTo=${encodeURIComponent(resolvedReturnTo)}`);
  };


  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/auth/atlassian/status', {
        method: 'DELETE',
      });
    } finally {
      setDisconnecting(false);
      await refresh();
    }
  }, [refresh]);

  const accessReason = access.reasons[product];
  const appCapability =
    product === 'jira' ? access.capabilities.jiraWrite : access.capabilities.confluenceWrite;
  const connectionCapability =
    product === 'jira'
      ? Boolean(status?.connection?.capabilities.jiraWrite)
      : Boolean(status?.connection?.capabilities.confluenceWrite);
  const writeEnabled =
    accessReason === 'write_enabled' &&
    Boolean(status?.configured) &&
    Boolean(status?.connected) &&
    connectionCapability;

  return {
    loading,
    disconnecting,
    status,
    access,
    accessReason,
    accessReasonLabel: ACCESS_REASON_LABELS[accessReason],
    appCapability,
    connectionCapability,
    writeEnabled,
    returnTo: resolvedReturnTo,
    oauthResult: searchParams.get('atlassian_oauth'),
    oauthError: searchParams.get('atlassian_oauth_error'),
    refresh,
    connect,
    disconnect,
  };
}
