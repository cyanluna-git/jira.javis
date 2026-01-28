'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  ExternalLink,
  Home,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { ConfluenceRenderer } from '@/components/ConfluenceRenderer';
import ConfluenceTree from '@/components/ConfluenceTree';
import ConfluenceSuggestionPanel from '@/components/ConfluenceSuggestionPanel';
import type { ConfluencePage, ConfluenceBreadcrumb, ConfluenceViewMode } from '@/types/confluence';

function ConfluencePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pageId = searchParams.get('pageId');

  const [viewMode, setViewMode] = useState<ConfluenceViewMode>('tree');
  const [activePage, setActivePage] = useState<ConfluencePage | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<ConfluenceBreadcrumb[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch page content
  const fetchPageContent = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/confluence/page/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActivePage(data.page);
        setBreadcrumbs(data.breadcrumbs || []);
      }
    } catch (error) {
      console.error('Error fetching page:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle page selection
  const handleSelectPage = (id: string) => {
    router.push(`/confluence?pageId=${id}`);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ConfluenceViewMode) => {
    setViewMode(mode);
    if (mode === 'suggestions') {
      // Clear page selection when viewing suggestions
      router.push('/confluence');
    }
  };

  useEffect(() => {
    if (pageId) {
      fetchPageContent(pageId);
    } else {
      setActivePage(null);
      setBreadcrumbs([]);
    }
  }, [pageId]);

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Sidebar with Tree */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <h1 className="font-bold text-gray-800">Confluence</h1>
        </div>

        {viewMode === 'suggestions' ? (
          <ConfluenceSuggestionPanel />
        ) : (
          <ConfluenceTree
            selectedPageId={pageId || undefined}
            onSelectPage={handleSelectPage}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : viewMode === 'suggestions' && !pageId ? (
          // Suggestions full view
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-gray-900">AI 문서 제안</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                AI가 분석한 문서 개선 제안을 확인하고 적용하세요
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SuggestionsFullView />
            </div>
          </div>
        ) : activePage ? (
          <>
            {/* Header with Breadcrumbs */}
            <div className="border-b border-gray-200 bg-white">
              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && (
                <div className="px-6 pt-4 flex items-center gap-1 text-sm text-gray-500">
                  <button
                    onClick={() => handleSelectPage(breadcrumbs[0]?.id)}
                    className="hover:text-blue-600 flex items-center gap-1"
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                  {breadcrumbs.map((crumb, idx) => (
                    <span key={crumb.id} className="flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      <button
                        onClick={() => handleSelectPage(crumb.id)}
                        className={clsx(
                          'hover:text-blue-600 truncate max-w-[150px]',
                          idx === breadcrumbs.length - 1 && 'text-gray-700 font-medium'
                        )}
                      >
                        {crumb.title}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <div className="p-6 pt-3 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{activePage.title}</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {activePage.labels && activePage.labels.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {activePage.labels.slice(0, 5).map(label => (
                          <span
                            key={label}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {label}
                          </span>
                        ))}
                        {activePage.labels.length > 5 && (
                          <span className="text-xs text-gray-400">
                            +{activePage.labels.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                    {activePage.is_orphan && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs flex items-center gap-1">
                        고아 페이지
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={activePage.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Confluence에서 열기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <ConfluenceRenderer content={activePage.body_storage} pageId={activePage.id} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>사이드바에서 페이지를 선택하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Suggestions Full View Component
function SuggestionsFullView() {
  const [suggestions, setSuggestions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      params.set('limit', '50');

      const res = await fetch(`/api/confluence/suggestions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-600">제안이 없습니다</h3>
        <p className="text-sm text-gray-400 mt-1">
          AI 분석을 실행하여 문서 개선 제안을 받으세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">전체</option>
          <option value="pending">대기중</option>
          <option value="approved">승인됨</option>
          <option value="rejected">거절됨</option>
          <option value="applied">적용됨</option>
        </select>
      </div>

      {/* Suggestions list would be rendered here */}
      <div className="text-sm text-gray-500">
        {suggestions.length}개의 제안
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

// Main export with Suspense boundary
export default function ConfluencePageView() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ConfluencePageContent />
    </Suspense>
  );
}
