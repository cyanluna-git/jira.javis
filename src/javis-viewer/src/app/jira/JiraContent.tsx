'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Loader2, Search, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { AtlassianConnectionBanner } from '@/components/AtlassianConnectionBanner';
import {
  DEFAULT_JIRA_ISSUE_PAGE_SIZE,
  type FilterOption,
  type JiraIssueFilterOptions,
  type JiraIssueListItem,
  type JiraIssueListResponse,
  type JiraIssueQueryState,
} from '@/types/jira-list';

import IssueRow from './IssueRow';

function getVisibleOptions(
  options: FilterOption[],
  selectedValueSet: ReadonlySet<string>,
  query: string
): FilterOption[] {
  if (options.length === 0) {
    return options;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const selected: FilterOption[] = [];
  const matching: FilterOption[] = [];

  for (const option of options) {
    if (selectedValueSet.has(option.label)) {
      selected.push(option);
      continue;
    }

    if (!normalizedQuery || option.label.toLowerCase().includes(normalizedQuery)) {
      matching.push(option);
    }
  }

  return [...selected, ...matching];
}

function buildQueryString(query: JiraIssueQueryState): string {
  const params = new URLSearchParams();

  if (query.page > 1) {
    params.set('page', String(query.page));
  }

  if (query.limit !== DEFAULT_JIRA_ISSUE_PAGE_SIZE) {
    params.set('limit', String(query.limit));
  }

  if (query.search.trim()) {
    params.set('search', query.search.trim());
  }

  if (query.projects.length > 0) {
    params.set('project', query.projects.join(','));
  }

  if (query.components.length > 0) {
    params.set('component', query.components.join(','));
  }

  if (query.assignees.length > 0) {
    params.set('assignee', query.assignees.join(','));
  }

  if (query.reporters.length > 0) {
    params.set('reporter', query.reporters.join(','));
  }

  return params.toString();
}

function getIssueRangeLabel(total: number, page: number, limit: number, itemCount: number): string {
  if (total === 0 || itemCount === 0) {
    return 'Showing 0 of 0 issues';
  }

  const start = (page - 1) * limit + 1;
  const end = start + itemCount - 1;
  return `Showing ${start}-${end} of ${total} issues`;
}

interface JiraContentProps {
  initialData: JiraIssueListResponse;
  filterOptions: JiraIssueFilterOptions;
  initialQuery: JiraIssueQueryState;
}

export default function JiraContent({
  initialData,
  filterOptions,
  initialQuery,
}: JiraContentProps) {
  const pathname = usePathname();
  const initialRequestKeyRef = useRef(buildQueryString(initialQuery));
  const skippedInitialFetchRef = useRef(false);

  const [issuesData, setIssuesData] = useState(initialData);
  const [searchKey, setSearchKey] = useState(initialQuery.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search);
  const [selectedProjects, setSelectedProjects] = useState(initialQuery.projects);
  const [selectedComponents, setSelectedComponents] = useState(initialQuery.components);
  const [selectedAssignees, setSelectedAssignees] = useState(initialQuery.assignees);
  const [selectedReporters, setSelectedReporters] = useState(initialQuery.reporters);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [reporterSearch, setReporterSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchKey.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchKey]);

  const selectedProjectSet = useMemo(() => new Set(selectedProjects), [selectedProjects]);
  const selectedComponentSet = useMemo(() => new Set(selectedComponents), [selectedComponents]);
  const selectedAssigneeSet = useMemo(() => new Set(selectedAssignees), [selectedAssignees]);
  const selectedReporterSet = useMemo(() => new Set(selectedReporters), [selectedReporters]);

  const visibleAssignees = useMemo(
    () => getVisibleOptions(filterOptions.assignees, selectedAssigneeSet, assigneeSearch),
    [assigneeSearch, filterOptions.assignees, selectedAssigneeSet]
  );
  const visibleReporters = useMemo(
    () => getVisibleOptions(filterOptions.reporters, selectedReporterSet, reporterSearch),
    [filterOptions.reporters, reporterSearch, selectedReporterSet]
  );

  const requestQuery = useMemo<JiraIssueQueryState>(() => ({
    page: issuesData.page,
    limit: issuesData.limit,
    search: debouncedSearch,
    projects: selectedProjects,
    components: selectedComponents,
    assignees: selectedAssignees,
    reporters: selectedReporters,
  }), [
    debouncedSearch,
    issuesData.limit,
    issuesData.page,
    selectedAssignees,
    selectedComponents,
    selectedProjects,
    selectedReporters,
  ]);

  const urlQuery = useMemo<JiraIssueQueryState>(() => ({
    ...requestQuery,
    search: searchKey.trim(),
  }), [requestQuery, searchKey]);

  const requestKey = useMemo(() => buildQueryString(requestQuery), [requestQuery]);
  const urlQueryString = useMemo(() => buildQueryString(urlQuery), [urlQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextUrl = urlQueryString ? `${pathname}?${urlQueryString}` : pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [pathname, urlQueryString]);

  useEffect(() => {
    if (!skippedInitialFetchRef.current && requestKey === initialRequestKeyRef.current) {
      skippedInitialFetchRef.current = true;
      return;
    }

    skippedInitialFetchRef.current = true;

    const controller = new AbortController();

    const loadIssues = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/jira/issues?${requestKey}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load Jira issues');
        }

        const nextData = await response.json() as JiraIssueListResponse;
        setIssuesData(nextData);
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load Jira issues');
      } finally {
        setIsLoading(false);
      }
    };

    void loadIssues();

    return () => controller.abort();
  }, [requestKey]);

  const setPage = (nextPage: number) => {
    setIssuesData((previous) => ({
      ...previous,
      page: Math.max(nextPage, 1),
    }));
  };

  const updateSearchKey = (value: string) => {
    setSearchKey(value);
    setPage(1);
  };

  const toggleProject = (project: string) => {
    setSelectedProjects((previous) =>
      previous.includes(project)
        ? previous.filter((value) => value !== project)
        : [...previous, project]
    );
    setPage(1);
  };

  const toggleComponent = (component: string) => {
    setSelectedComponents((previous) =>
      previous.includes(component)
        ? previous.filter((value) => value !== component)
        : [...previous, component]
    );
    setPage(1);
  };

  const toggleAssignee = (assignee: string) => {
    setSelectedAssignees((previous) =>
      previous.includes(assignee)
        ? previous.filter((value) => value !== assignee)
        : [...previous, assignee]
    );
    setPage(1);
  };

  const toggleReporter = (reporter: string) => {
    setSelectedReporters((previous) =>
      previous.includes(reporter)
        ? previous.filter((value) => value !== reporter)
        : [...previous, reporter]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearchKey('');
    setDebouncedSearch('');
    setSelectedProjects([]);
    setSelectedComponents([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setAssigneeSearch('');
    setReporterSearch('');
    setPage(1);
  };

  const filterSelectionCount =
    selectedProjects.length +
    selectedComponents.length +
    selectedAssignees.length +
    selectedReporters.length;
  const hasActiveFilters = Boolean(searchKey) || filterSelectionCount > 0;
  const totalPages = issuesData.total === 0 ? 1 : Math.ceil(issuesData.total / issuesData.limit);

  return (
    <>
      <div className="mb-6">
        <Suspense fallback={null}>
          <AtlassianConnectionBanner product="jira" />
        </Suspense>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by key or summary"
              value={searchKey}
              maxLength={200}
              onChange={(event) => updateSearchKey(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-5 w-5" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {filterSelectionCount || '•'}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <FilterSection
                title="Project"
                accentClassName="bg-blue-500"
                checkboxClassName="text-blue-600 focus:ring-blue-500"
                options={filterOptions.projects}
                selectedValueSet={selectedProjectSet}
                onToggle={toggleProject}
                emptyMessage="No projects found"
              />

              <FilterSection
                title="Component"
                accentClassName="bg-purple-500"
                checkboxClassName="text-purple-600 focus:ring-purple-500"
                options={filterOptions.components}
                selectedValueSet={selectedComponentSet}
                onToggle={toggleComponent}
                emptyMessage="No components found"
                scrollable
              />

              <FilterSection
                title="Assigned"
                accentClassName="bg-emerald-500"
                checkboxClassName="text-emerald-600 focus:ring-emerald-500"
                options={visibleAssignees}
                selectedValueSet={selectedAssigneeSet}
                onToggle={toggleAssignee}
                emptyMessage={assigneeSearch ? 'No assignees match this search' : 'No assignees found'}
                searchValue={assigneeSearch}
                onSearchChange={setAssigneeSearch}
                searchPlaceholder="Search assignees"
                scrollable
              />

              <FilterSection
                title="Reporter"
                accentClassName="bg-amber-500"
                checkboxClassName="text-amber-600 focus:ring-amber-500"
                options={visibleReporters}
                selectedValueSet={selectedReporterSet}
                onToggle={toggleReporter}
                emptyMessage={reporterSearch ? 'No reporters match this search' : 'No reporters found'}
                searchValue={reporterSearch}
                onSearchChange={setReporterSearch}
                searchPlaceholder="Search reporters"
                scrollable
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <span>{getIssueRangeLabel(issuesData.total, issuesData.page, issuesData.limit, issuesData.items.length)}</span>
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating
              </span>
            )}
          </span>
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {searchKey && (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  Key: {searchKey}
                </span>
              )}
              {selectedProjects.map((project) => (
                <span key={project} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                  {project}
                </span>
              ))}
              {selectedComponents.map((component) => (
                <span key={component} className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
                  {component}
                </span>
              ))}
              {selectedAssignees.map((assignee) => (
                <span key={assignee} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                  Assigned: {assignee}
                </span>
              ))}
              {selectedReporters.map((reporter) => (
                <span key={reporter} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                  Reporter: {reporter}
                </span>
              ))}
            </div>
          )}
        </div>
        {error && issuesData.items.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to refresh issues: {error}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-32 px-6 py-4 font-semibold text-gray-700">Key</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Summary</th>
              <th className="w-32 px-6 py-4 font-semibold text-gray-700">Status</th>
              <th className="w-24 px-6 py-4 font-semibold text-gray-700">Project</th>
              <th className="w-40 px-6 py-4 font-semibold text-gray-700">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issuesData.items.length > 0 ? (
              issuesData.items.map((issue: JiraIssueListItem) => (
                <IssueRow key={issue.key} issue={issue} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  {error ? `Failed to load issues: ${error}` : 'No issues found matching your filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <span>
          Page <span className="font-semibold text-gray-800">{issuesData.page}</span> of{' '}
          <span className="font-semibold text-gray-800">{totalPages}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(issuesData.page - 1)}
            disabled={issuesData.page <= 1 || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={() => setPage(issuesData.page + 1)}
            disabled={issuesData.page >= totalPages || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function FilterSection({
  title,
  accentClassName,
  checkboxClassName,
  options,
  selectedValueSet,
  onToggle,
  emptyMessage,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  scrollable = false,
}: {
  title: string;
  accentClassName: string;
  checkboxClassName: string;
  options: FilterOption[];
  selectedValueSet: ReadonlySet<string>;
  onToggle: (value: string) => void;
  emptyMessage: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  scrollable?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-700">
        <span className={`h-4 w-1 rounded ${accentClassName}`}></span>
        {title}
      </h3>
      {onSearchChange && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      )}
      <div className={`space-y-2 ${scrollable ? 'max-h-48 overflow-y-auto' : ''}`}>
        {options.length > 0 ? (
          options.map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedValueSet.has(option.label)}
                onChange={() => onToggle(option.label)}
                className={`h-4 w-4 rounded border-gray-300 ${checkboxClassName}`}
              />
              <span className="text-gray-700">{option.label}</span>
              <span className="ml-auto text-sm text-gray-400">({option.count})</span>
            </label>
          ))
        ) : (
          <p className="text-sm italic text-gray-400">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
