'use client';

import { useDeferredValue, useMemo, useState, Suspense } from 'react';
import { Search, Filter, X } from 'lucide-react';
import IssueRow from './IssueRow';
import { AtlassianConnectionBanner } from '@/components/AtlassianConnectionBanner';

interface IssueComponent {
  name?: string | null;
}

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
  components: IssueComponent[];
  assignee: string | null;
  reporter: string | null;
}

interface FilterOption {
  label: string;
  count: number;
}

interface IndexedIssue {
  issue: Issue;
  componentLabels: string[];
  assigneeLabel: string;
  reporterLabel: string;
  searchText: string;
}

interface FilterIndex {
  issues: IndexedIssue[];
  projects: FilterOption[];
  components: FilterOption[];
  assignees: FilterOption[];
  reporters: FilterOption[];
}

const UNASSIGNED_ASSIGNEE = 'Unassigned';
const UNKNOWN_REPORTER = 'Unknown reporter';

function normalizeFilterValue(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function toSortedOptions(counts: Map<string, number>): FilterOption[] {
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
}

function buildFilterIndex(issues: Issue[]): FilterIndex {
  const projectCounts = new Map<string, number>();
  const componentCounts = new Map<string, number>();
  const assigneeCounts = new Map<string, number>();
  const reporterCounts = new Map<string, number>();
  const indexedIssues: IndexedIssue[] = [];

  for (const issue of issues) {
    projectCounts.set(issue.project, (projectCounts.get(issue.project) || 0) + 1);

    const assigneeLabel = normalizeFilterValue(issue.assignee, UNASSIGNED_ASSIGNEE);
    assigneeCounts.set(assigneeLabel, (assigneeCounts.get(assigneeLabel) || 0) + 1);

    const reporterLabel = normalizeFilterValue(issue.reporter, UNKNOWN_REPORTER);
    reporterCounts.set(reporterLabel, (reporterCounts.get(reporterLabel) || 0) + 1);

    const componentLabels: string[] = [];
    for (const component of issue.components || []) {
      const name = component.name?.trim();
      if (!name) continue;
      componentLabels.push(name);
      componentCounts.set(name, (componentCounts.get(name) || 0) + 1);
    }

    indexedIssues.push({
      issue,
      componentLabels,
      assigneeLabel,
      reporterLabel,
      searchText: `${issue.key} ${issue.summary}`.toLowerCase(),
    });
  }

  return {
    issues: indexedIssues,
    projects: toSortedOptions(projectCounts),
    components: toSortedOptions(componentCounts),
    assignees: toSortedOptions(assigneeCounts),
    reporters: toSortedOptions(reporterCounts),
  };
}

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

export default function JiraContent({ issues }: { issues: Issue[] }) {
  const [searchKey, setSearchKey] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [reporterSearch, setReporterSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filterIndex = useMemo(() => buildFilterIndex(issues), [issues]);
  const searchLower = useDeferredValue(searchKey.trim().toLowerCase());
  const assigneeSearchLower = useDeferredValue(assigneeSearch.trim().toLowerCase());
  const reporterSearchLower = useDeferredValue(reporterSearch.trim().toLowerCase());
  const selectedProjectSet = useMemo(() => new Set(selectedProjects), [selectedProjects]);
  const selectedComponentSet = useMemo(() => new Set(selectedComponents), [selectedComponents]);
  const selectedAssigneeSet = useMemo(() => new Set(selectedAssignees), [selectedAssignees]);
  const selectedReporterSet = useMemo(() => new Set(selectedReporters), [selectedReporters]);

  const visibleAssignees = useMemo(
    () => getVisibleOptions(filterIndex.assignees, selectedAssigneeSet, assigneeSearchLower),
    [filterIndex.assignees, selectedAssigneeSet, assigneeSearchLower]
  );
  const visibleReporters = useMemo(
    () => getVisibleOptions(filterIndex.reporters, selectedReporterSet, reporterSearchLower),
    [filterIndex.reporters, selectedReporterSet, reporterSearchLower]
  );

  // Filter issues
  const filteredIssues = useMemo(() => {
    return filterIndex.issues
      .filter((indexedIssue) => {
        if (searchLower && !indexedIssue.searchText.includes(searchLower)) {
          return false;
        }

        if (selectedProjectSet.size > 0 && !selectedProjectSet.has(indexedIssue.issue.project)) {
          return false;
        }

        if (selectedComponentSet.size > 0) {
          let hasMatchingComponent = false;
          for (const componentLabel of indexedIssue.componentLabels) {
            if (selectedComponentSet.has(componentLabel)) {
              hasMatchingComponent = true;
              break;
            }
          }

          if (!hasMatchingComponent) {
            return false;
          }
        }

        if (selectedAssigneeSet.size > 0 && !selectedAssigneeSet.has(indexedIssue.assigneeLabel)) {
          return false;
        }

        if (selectedReporterSet.size > 0 && !selectedReporterSet.has(indexedIssue.reporterLabel)) {
          return false;
        }

        return true;
      })
      .map((indexedIssue) => indexedIssue.issue);
  }, [
    filterIndex.issues,
    searchLower,
    selectedProjectSet,
    selectedComponentSet,
    selectedAssigneeSet,
    selectedReporterSet,
  ]);

  const toggleProject = (project: string) => {
    setSelectedProjects(prev =>
      prev.includes(project)
        ? prev.filter(p => p !== project)
        : [...prev, project]
    );
  };

  const toggleComponent = (component: string) => {
    setSelectedComponents(prev =>
      prev.includes(component)
        ? prev.filter(c => c !== component)
        : [...prev, component]
    );
  };

  const toggleAssignee = (assignee: string) => {
    setSelectedAssignees(prev =>
      prev.includes(assignee)
        ? prev.filter(value => value !== assignee)
        : [...prev, assignee]
    );
  };

  const toggleReporter = (reporter: string) => {
    setSelectedReporters(prev =>
      prev.includes(reporter)
        ? prev.filter(value => value !== reporter)
        : [...prev, reporter]
    );
  };

  const clearFilters = () => {
    setSearchKey('');
    setSelectedProjects([]);
    setSelectedComponents([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setAssigneeSearch('');
    setReporterSearch('');
  };

  const filterSelectionCount =
    selectedProjects.length +
    selectedComponents.length +
    selectedAssignees.length +
    selectedReporters.length;
  const hasActiveFilters = Boolean(searchKey) || filterSelectionCount > 0;

  return (
    <>
      <div className="mb-6">
        <Suspense fallback={null}>
          <AtlassianConnectionBanner product="jira" />
        </Suspense>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by key or summary"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {filterSelectionCount || '•'}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Project Filter */}
              <FilterSection
                title="Project"
                accentClassName="bg-blue-500"
                checkboxClassName="text-blue-600 focus:ring-blue-500"
                options={filterIndex.projects}
                selectedValueSet={selectedProjectSet}
                onToggle={toggleProject}
                emptyMessage="No projects found"
              />

              {/* Component Filter */}
              <FilterSection
                title="Component"
                accentClassName="bg-purple-500"
                checkboxClassName="text-purple-600 focus:ring-purple-500"
                options={filterIndex.components}
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

        {/* Results Info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{filteredIssues.length}</span> of{' '}
            <span className="font-semibold text-gray-700">{issues.length}</span> issues
          </span>
          {hasActiveFilters && (
            <div className="flex gap-2 flex-wrap">
              {searchKey && (
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                  Key: {searchKey}
                </span>
              )}
              {selectedProjects.map(proj => (
                <span key={proj} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  {proj}
                </span>
              ))}
              {selectedComponents.map(comp => (
                <span key={comp} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                  {comp}
                </span>
              ))}
              {selectedAssignees.map(assignee => (
                <span key={assignee} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">
                  Assigned: {assignee}
                </span>
              ))}
              {selectedReporters.map(reporter => (
                <span key={reporter} className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">
                  Reporter: {reporter}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-700 w-32">Key</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Summary</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-32">Status</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-24">Project</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-40">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <IssueRow key={issue.key} issue={issue} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No issues found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span className={`w-1 h-4 rounded ${accentClassName}`}></span>
        {title}
      </h3>
      {onSearchChange && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedValueSet.has(option.label)}
                onChange={() => onToggle(option.label)}
                className={`w-4 h-4 border-gray-300 rounded ${checkboxClassName}`}
              />
              <span className="text-gray-700">{option.label}</span>
              <span className="ml-auto text-sm text-gray-400">({option.count})</span>
            </label>
          ))
        ) : (
          <p className="text-gray-400 text-sm italic">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
