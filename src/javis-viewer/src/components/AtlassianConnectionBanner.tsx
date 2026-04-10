'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, ShieldAlert, Unplug } from 'lucide-react';
import clsx from 'clsx';
import { useAtlassianConnection } from '@/hooks/useAtlassianConnection';

type AtlassianProduct = 'jira' | 'confluence';

interface Props {
  product: AtlassianProduct;
  compact?: boolean;
}

const PRODUCT_LABEL: Record<AtlassianProduct, string> = {
  jira: 'Jira',
  confluence: 'Confluence',
};

export function AtlassianConnectionBanner({ product, compact = false }: Props) {
  const {
    loading,
    disconnecting,
    status,
    accessReason,
    accessReasonLabel,
    writeEnabled,
    oauthResult,
    oauthError,
    connect,
    disconnect,
    refresh,
  } = useAtlassianConnection(product);

  const [dismissed, setDismissed] = useState(false);

  const tone = useMemo(() => {
    if (writeEnabled) {
      return {
        container: 'border-emerald-200 bg-emerald-50',
        title: 'text-emerald-900',
        body: 'text-emerald-800',
        icon: 'text-emerald-600',
      };
    }

    return {
      container: 'border-amber-200 bg-amber-50',
      title: 'text-amber-900',
      body: 'text-amber-800',
      icon: 'text-amber-600',
    };
  }, [writeEnabled]);

  const detailMessage = (() => {
    if (!status?.configured) {
      return 'Atlassian OAuth 설정이 아직 서버에 등록되지 않았습니다.';
    }

    if (accessReason === 'global_read_only') {
      return accessReasonLabel;
    }

    if (!status.connected) {
      return `${PRODUCT_LABEL[product]} write를 쓰려면 Atlassian 계정을 연결해야 합니다. 연결하지 않은 사용자는 readonly로 유지됩니다.`;
    }

    if (!writeEnabled) {
      if (accessReason !== 'write_enabled') {
        return accessReasonLabel;
      }

      return `연결된 Atlassian 계정에 ${PRODUCT_LABEL[product]} write scope 또는 대상 사이트 권한이 부족합니다.`;
    }

    const accountName = status.connection?.account.name || status.connection?.account.email || 'Atlassian account';
    const siteName = status.connection?.site.name || status.connection?.site.url || 'selected site';
    return `${accountName} 계정으로 ${siteName}에 연결되어 있으며 ${PRODUCT_LABEL[product]} 직접 수정이 가능합니다.`;
  })();

  const showOauthResult = !dismissed && (oauthResult === 'connected' || Boolean(oauthError));

  return (
    <div className="space-y-3">
      {showOauthResult && (
        <div
          className={clsx(
            'rounded-xl border px-4 py-3 text-sm',
            oauthError
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {oauthError ? `Atlassian 연결 실패: ${oauthError}` : 'Atlassian 계정 연결이 완료되었습니다.'}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className={clsx('rounded-2xl border px-4 py-4', tone.container, compact && 'rounded-xl px-3 py-3')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {loading ? (
                <Loader2 className={clsx('h-4 w-4 animate-spin', tone.icon)} />
              ) : writeEnabled ? (
                <CheckCircle2 className={clsx('h-4 w-4', tone.icon)} />
              ) : (
                <ShieldAlert className={clsx('h-4 w-4', tone.icon)} />
              )}
              <div className={clsx('text-sm font-semibold', tone.title)}>
                {PRODUCT_LABEL[product]} access
              </div>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  writeEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                )}
              >
                {writeEnabled ? 'write enabled' : 'readonly'}
              </span>
            </div>

            <p className={clsx('mt-2 text-sm', tone.body)}>
              {loading ? 'Atlassian 연결 상태를 확인하는 중입니다.' : detailMessage}
            </p>

            {status?.connection?.site?.url && (
              <a
                href={status.connection.site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx('mt-2 inline-flex items-center gap-1 text-xs hover:underline', tone.body)}
              >
                Connected site
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>

            {status?.connected ? (
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={!status?.configured || accessReason === 'global_read_only'}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect Atlassian
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
