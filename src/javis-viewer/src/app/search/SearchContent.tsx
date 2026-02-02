'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, CheckSquare, FileText, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import IssueDetailModal from '@/components/IssueDetailModal';
import ConfluencePageModal from '@/components/ConfluencePageModal';
import type { SprintIssue } from '@/types/sprint';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';

interface JiraResult {
  type: 'jira';
  key: string;
  summary: string;
  status: string;
  project: string;
  assignee: string | null;
  updated: string;
  matchField: string;
}

interface ConfluenceResult {
  type: 'confluence';
  id: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  updated: string;
  excerpt: string;
}

type SearchResult = JiraResult | ConfluenceResult;

interface Props {
  initialQuery: string;
  initialFilter: string;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  jiraResults: SearchResult[];
  confluenceResults: SearchResult[];
  jiraTotal: number;
  confluenceTotal: number;
  pageSize: number;
}

const STATUS_COLORS: Record<string, string> = {
  'Done': '#22c55e',
  'Closed': '#22c55e',
  'Resolved': '#22c55e',
  'In Progress': '#3b82f6',
  'In Review': '#8b5cf6',
  'Testing': '#f59e0b',
  'To Do': '#9ca3af',
  'Open': '#9ca3af',
  'Backlog': '#6b7280',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#9ca3af';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  // Remove HTML/XML tags and decode entities
  return html
    .replace(/<[^>]*>/g, ' ')  // Remove tags
    .replace(/&nbsp;/g, ' ')   // Replace nbsp
    .replace(/&amp;/g, '&')    // Decode &
    .replace(/&lt;/g, '<')     // Decode <
    .replace(/&gt;/g, '>')     // Decode >
    .replace(/&quot;/g, '"')   // Decode "
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}

function JiraResultCard({
  result,
  onClick,
  isLoading,
}: {
  result: JiraResult;
  onClick: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-blue-600 flex-shrink-0 animate-spin" />
            ) : (
              <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
            <span className="text-blue-600 font-medium text-sm">{result.key}</span>
            <span
              className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: getStatusColor(result.status) + '20',
                color: getStatusColor(result.status),
              }}
            >
              {result.status}
            </span>
          </div>
          <h3 className="text-gray-900 font-medium truncate">{result.summary}</h3>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{result.project}</span>
            {result.assignee && <span>{result.assignee}</span>}
            {result.updated && <span>{formatDate(result.updated)}</span>}
            <span className="text-gray-400">matched in {result.matchField}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfluenceResultCard({
  result,
  onClick,
  isLoading,
}: {
  result: ConfluenceResult;
  onClick: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-orange-600 flex-shrink-0 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
            )}
            <span className="text-orange-600 font-medium text-sm">{result.title}</span>
          </div>
          {result.excerpt && (
            <p className="text-gray-600 text-sm line-clamp-2 mt-1">{stripHtmlTags(result.excerpt)}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-0.5 rounded">{result.spaceName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  query,
  filter,
}: {
  currentPage: number;
  totalPages: number;
  query: string;
  filter: string;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (filter !== 'all') params.set('filter', filter);
    if (page > 1) params.set('page', String(page));
    return `/search?${params.toString()}`;
  };

  const pages: (number | 'ellipsis')[] = [];
  const showPages = 5;

  if (totalPages <= showPages + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      end = Math.min(showPages, totalPages - 1);
    } else if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - showPages + 1);
    }

    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');

    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Link
        href={buildUrl(currentPage - 1)}
        className={`p-2 rounded-lg border ${
          currentPage === 1
            ? 'border-gray-200 text-gray-300 pointer-events-none'
            : 'border-gray-300 text-gray-600 hover:bg-gray-100'
        }`}
        aria-disabled={currentPage === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>

      {pages.map((page, idx) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
        ) : (
          <Link
            key={page}
            href={buildUrl(page)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              page === currentPage
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {page}
          </Link>
        )
      )}

      <Link
        href={buildUrl(currentPage + 1)}
        className={`p-2 rounded-lg border ${
          currentPage === totalPages
            ? 'border-gray-200 text-gray-300 pointer-events-none'
            : 'border-gray-300 text-gray-600 hover:bg-gray-100'
        }`}
        aria-disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function SearchContent({
  initialQuery,
  initialFilter,
  currentPage,
  totalPages,
  totalResults,
  jiraResults,
  confluenceResults,
  jiraTotal,
  confluenceTotal,
  pageSize,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);

  // Modal states
  const [selectedIssue, setSelectedIssue] = useState<SprintIssue | null>(null);
  const [selectedPage, setSelectedPage] = useState<ConfluencePage | null>(null);
  const [pageBreadcrumbs, setPageBreadcrumbs] = useState<ConfluenceBreadcrumb[]>([]);
  const [loadingIssueKey, setLoadingIssueKey] = useState<string | null>(null);
  const [loadingPageId, setLoadingPageId] = useState<string | null>(null);

  // Fetch issue details and open modal
  const handleIssueClick = useCallback(async (issueKey: string) => {
    setLoadingIssueKey(issueKey);
    try {
      const res = await fetch(`/api/issues/${issueKey}`);
      if (!res.ok) throw new Error('Failed to fetch issue');
      const issue: SprintIssue = await res.json();
      setSelectedIssue(issue);
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      setLoadingIssueKey(null);
    }
  }, []);

  // Fetch page details and open modal
  const handlePageClick = useCallback(async (pageId: string) => {
    setLoadingPageId(pageId);
    try {
      const res = await fetch(`/api/confluence/page/${pageId}`);
      if (!res.ok) throw new Error('Failed to fetch page');
      const data: { page: ConfluencePage; breadcrumbs: ConfluenceBreadcrumb[] } = await res.json();
      setSelectedPage(data.page);
      setPageBreadcrumbs(data.breadcrumbs || []);
    } catch (error) {
      console.error('Error fetching confluence page:', error);
    } finally {
      setLoadingPageId(null);
    }
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= 2) {
      const params = new URLSearchParams();
      params.set('q', query);
      if (filter !== 'all') params.set('filter', filter);
      router.push(`/search?${params.toString()}`);
    }
  }, [query, filter, router]);

  const handleFilterChange = useCallback((newFilter: string) => {
    setFilter(newFilter);
    const searchQuery = query.length >= 2 ? query : initialQuery;
    if (searchQuery.length >= 2) {
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (newFilter !== 'all') params.set('filter', newFilter);
      router.push(`/search?${params.toString()}`);
    }
  }, [query, initialQuery, router]);

  const combinedResults = [...jiraResults, ...confluenceResults];
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalResults);

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Jira issues and Confluence pages..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Search
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All', count: jiraTotal + confluenceTotal },
            { value: 'jira', label: 'Jira', count: jiraTotal },
            { value: 'confluence', label: 'Confluence', count: confluenceTotal },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                initialFilter === f.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {initialQuery && (
                <span className="ml-1.5 text-xs opacity-70">({f.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {!initialQuery ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Enter a search term to find Jira issues and Confluence pages</p>
          <p className="text-gray-400 text-sm mt-1">Minimum 2 characters required</p>
        </div>
      ) : totalResults === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results found for &quot;{initialQuery}&quot;</p>
          <p className="text-gray-400 text-sm mt-1">Try different keywords or check the spelling</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Showing {startIdx}-{endIdx} of {totalResults} results for &quot;{initialQuery}&quot;
          </p>

          {initialFilter === 'all' && (
            <div className="space-y-3">
              {combinedResults.map((result) =>
                result.type === 'jira' ? (
                  <JiraResultCard
                    key={result.key}
                    result={result}
                    onClick={() => handleIssueClick(result.key)}
                    isLoading={loadingIssueKey === result.key}
                  />
                ) : (
                  <ConfluenceResultCard
                    key={result.id}
                    result={result}
                    onClick={() => handlePageClick(result.id)}
                    isLoading={loadingPageId === result.id}
                  />
                )
              )}
            </div>
          )}

          {initialFilter === 'jira' && (
            <div className="space-y-3">
              {jiraResults.map((result) => (
                <JiraResultCard
                  key={(result as JiraResult).key}
                  result={result as JiraResult}
                  onClick={() => handleIssueClick((result as JiraResult).key)}
                  isLoading={loadingIssueKey === (result as JiraResult).key}
                />
              ))}
            </div>
          )}

          {initialFilter === 'confluence' && (
            <div className="space-y-3">
              {confluenceResults.map((result) => (
                <ConfluenceResultCard
                  key={(result as ConfluenceResult).id}
                  result={result as ConfluenceResult}
                  onClick={() => handlePageClick((result as ConfluenceResult).id)}
                  isLoading={loadingPageId === (result as ConfluenceResult).id}
                />
              ))}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            query={initialQuery}
            filter={initialFilter}
          />
        </div>
      )}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {/* Confluence Page Modal */}
      {selectedPage && (
        <ConfluencePageModal
          page={selectedPage}
          breadcrumbs={pageBreadcrumbs}
          onClose={() => {
            setSelectedPage(null);
            setPageBreadcrumbs([]);
          }}
        />
      )}
    </div>
  );
}
