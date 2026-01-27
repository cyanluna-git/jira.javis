'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, CheckSquare, FileText, ExternalLink, Filter } from 'lucide-react';

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
  jiraResults: JiraResult[];
  confluenceResults: ConfluenceResult[];
  combinedResults: SearchResult[];
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

function JiraResultCard({ result }: { result: JiraResult }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <Link
              href={`/jira?search=${result.key}`}
              className="text-blue-600 hover:underline font-medium text-sm"
            >
              {result.key}
            </Link>
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

function ConfluenceResultCard({ result }: { result: ConfluenceResult }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <Link
              href={`/confluence?pageId=${result.id}`}
              className="text-orange-600 hover:underline font-medium text-sm"
            >
              {result.title}
            </Link>
          </div>
          {result.excerpt && (
            <p className="text-gray-600 text-sm line-clamp-2 mt-1">{result.excerpt}...</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-0.5 rounded">{result.spaceName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchContent({
  initialQuery,
  initialFilter,
  jiraResults,
  confluenceResults,
  combinedResults,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);

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
    // Use current query state for more responsive UX
    const searchQuery = query.length >= 2 ? query : initialQuery;
    if (searchQuery.length >= 2) {
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (newFilter !== 'all') params.set('filter', newFilter);
      router.push(`/search?${params.toString()}`);
    }
  }, [query, initialQuery, router]);

  const totalResults = filter === 'all'
    ? combinedResults.length
    : filter === 'jira'
      ? jiraResults.length
      : confluenceResults.length;

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
            { value: 'all', label: 'All', count: combinedResults.length },
            { value: 'jira', label: 'Jira', count: jiraResults.length },
            { value: 'confluence', label: 'Confluence', count: confluenceResults.length },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.value
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
            Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{initialQuery}&quot;
          </p>

          {filter === 'all' && (
            <div className="space-y-3">
              {combinedResults.map((result) => (
                result.type === 'jira' ? (
                  <JiraResultCard key={result.key} result={result} />
                ) : (
                  <ConfluenceResultCard key={result.id} result={result} />
                )
              ))}
            </div>
          )}

          {filter === 'jira' && (
            <div className="space-y-3">
              {jiraResults.map((result) => (
                <JiraResultCard key={result.key} result={result} />
              ))}
            </div>
          )}

          {filter === 'confluence' && (
            <div className="space-y-3">
              {confluenceResults.map((result) => (
                <ConfluenceResultCard key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
