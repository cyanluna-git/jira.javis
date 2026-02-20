'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Calendar, Target, ChevronRight, ChevronDown, Users, Box, ArrowUpDown, ArrowUp, ArrowDown, FileText, Settings } from 'lucide-react';
import SprintCard from './SprintCard';
import SprintIssueRow from './SprintIssueRow';
import SprintLabelEditor from './SprintLabelEditor';
import IssueDetailModal from '@/components/IssueDetailModal';
import BurndownChart from '@/components/BurndownChart';
import ComponentPieChart from '@/components/ComponentPieChart';
import ComponentProgressChart from '@/components/ComponentProgressChart';
import SprintDocumentCard from '@/components/SprintDocumentCard';
import ConfluencePageModal from '@/components/ConfluencePageModal';
import { useReadOnly } from '@/contexts/ReadOnlyContext';
import type { Board, Sprint, SprintIssue, Assignee, IssueStats } from '@/types/sprint';
import type { ConfluencePage } from '@/types/confluence';

interface Props {
  boards: Board[];
  sprints: Sprint[];
  issues: SprintIssue[];
  selectedBoardId: number | null;
  selectedSprintId: number | null;
  selectedSprint: Sprint | null;
  stateFilter: string;
  initialAssignees?: string[];
  initialComponents?: string[];
}

type SortField = 'key' | 'status' | 'points' | 'assignee';
type SortOrder = 'asc' | 'desc';

// Convert sprint name to label format
// "SCALED Sprint 14" → "scaled-sprint14"
// "OQC Sprint 01" → "oqc-sprint01"
// "EUV Sprint 5" → "euv-sprint5"
function getSprintLabel(sprintName: string): string {
  const normalized = sprintName
    .toLowerCase()
    .replace(/\s+sprint\s*/i, '-sprint')
    .replace(/\s+/g, '-');
  return normalized;
}

export default function SprintContent({
  boards,
  sprints,
  issues,
  selectedBoardId,
  selectedSprintId,
  selectedSprint,
  stateFilter,
  initialAssignees = [],
  initialComponents = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReadOnly = useReadOnly();

  const [selectedIssue, setSelectedIssue] = useState<SprintIssue | null>(null);
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  const [showComponentFilter, setShowComponentFilter] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set(initialAssignees));
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set(initialComponents));
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Sprint Documents state
  const [sprintDocuments, setSprintDocuments] = useState<ConfluencePage[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ConfluencePage | null>(null);
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [currentSprintLabels, setCurrentSprintLabels] = useState<string[]>([]);

  // Sync state with URL params when they change (e.g. browser back/forward)
  // Using join() to prevent unnecessary re-runs from array reference changes
  useEffect(() => {
    setSelectedAssignees(new Set(initialAssignees));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAssignees.join(',')]);

  useEffect(() => {
    setSelectedComponents(new Set(initialComponents));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialComponents.join(',')]);

  // Fetch sprint documents when sprint changes
  useEffect(() => {
    if (!selectedSprint) {
      setSprintDocuments([]);
      setCurrentSprintLabels([]);
      return;
    }

    const sprintLabel = getSprintLabel(selectedSprint.name);
    const customLabels = selectedSprint.confluence_labels || [];
    setCurrentSprintLabels(customLabels);

    // Combine auto-generated label with custom labels
    const allLabels = [sprintLabel, ...customLabels];

    const fetchDocuments = async () => {
      setIsLoadingDocuments(true);
      try {
        const response = await fetch(`/api/confluence/by-labels?labels=${encodeURIComponent(allLabels.join(','))}`);
        if (response.ok) {
          const data = await response.json();
          setSprintDocuments(data.pages || []);
        } else {
          setSprintDocuments([]);
        }
      } catch (error) {
        console.error('Failed to fetch sprint documents:', error);
        setSprintDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, [selectedSprint]);

  // URL 업데이트 - useEffect로 상태 변경 후 동기화
  useEffect(() => {
    // Skip if both are at initial state (to avoid unnecessary URL update on mount)
    const currentAssignees = searchParams.get('assignees')?.split(',').filter(Boolean) || [];
    const currentComponents = searchParams.get('components')?.split(',').filter(Boolean) || [];

    const assigneesChanged =
      selectedAssignees.size !== currentAssignees.length ||
      !currentAssignees.every(a => selectedAssignees.has(a));
    const componentsChanged =
      selectedComponents.size !== currentComponents.length ||
      !currentComponents.every(c => selectedComponents.has(c));

    if (!assigneesChanged && !componentsChanged) return;

    const params = new URLSearchParams(searchParams.toString());

    if (selectedAssignees.size > 0) {
      params.set('assignees', Array.from(selectedAssignees).join(','));
    } else {
      params.delete('assignees');
    }

    if (selectedComponents.size > 0) {
      params.set('components', Array.from(selectedComponents).join(','));
    } else {
      params.delete('components');
    }

    router.replace(`/sprints?${params.toString()}`, { scroll: false });
  }, [selectedAssignees, selectedComponents, router, searchParams]);

  // Filter sprints by state
  const filteredSprints = useMemo(() => {
    if (stateFilter === 'all') return sprints;
    return sprints.filter(s => s.state === stateFilter);
  }, [sprints, stateFilter]);

  // Extract assignees from issues
  const assignees = useMemo<Assignee[]>(() => {
    const map = new Map<string, { count: number; avatarUrl: string | null }>();
    issues.forEach(issue => {
      const assignee = issue.raw_data?.fields?.assignee;
      const name = assignee?.displayName || 'Unassigned';
      const avatarUrl = assignee?.avatarUrls?.['24x24'] || null;
      const existing = map.get(name);
      if (existing) {
        existing.count++;
      } else {
        map.set(name, { count: 1, avatarUrl });
      }
    });
    return Array.from(map.entries())
      .map(([name, { count, avatarUrl }]) => ({ name, count, avatarUrl }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  // Extract components from issues
  const components = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach(issue => {
      const comps = issue.raw_data?.fields?.components || [];
      if (comps.length === 0) {
        map.set('No Component', (map.get('No Component') || 0) + 1);
      } else {
        comps.forEach((c: any) => {
          const name = c.name || 'Unknown';
          map.set(name, (map.get(name) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  // Filter issues by selected assignees and components
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Assignee filter
      if (selectedAssignees.size > 0) {
        const name = issue.raw_data?.fields?.assignee?.displayName || 'Unassigned';
        if (!selectedAssignees.has(name)) return false;
      }

      // Component filter
      if (selectedComponents.size > 0) {
        const comps = issue.raw_data?.fields?.components || [];
        const compNames = comps.length > 0
          ? comps.map((c: any) => c.name || 'Unknown')
          : ['No Component'];
        const hasMatch = compNames.some((name: string) => selectedComponents.has(name));
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [issues, selectedAssignees, selectedComponents]);

  // Sort issues
  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'key':
          aVal = a.key;
          bVal = b.key;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'points':
          aVal = a.raw_data?.fields?.customfield_10016 || a.raw_data?.fields?.storyPoints || 0;
          bVal = b.raw_data?.fields?.customfield_10016 || b.raw_data?.fields?.storyPoints || 0;
          break;
        case 'assignee':
          aVal = a.raw_data?.fields?.assignee?.displayName || 'zzz';
          bVal = b.raw_data?.fields?.assignee?.displayName || 'zzz';
          break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredIssues, sortField, sortOrder]);

  // Count issues by status category with points
  const issueStats = useMemo<IssueStats>(() => {
    const stats: IssueStats = {
      todo: 0,
      inProgress: 0,
      done: 0,
      totalPoints: 0,
      donePoints: 0,
    };

    filteredIssues.forEach(issue => {
      const status = issue.status.toLowerCase();
      const fields = issue.raw_data?.fields || {};
      const points = fields.customfield_10016 || fields.storyPoints || 0;

      stats.totalPoints += points;

      if (status === 'done' || status === 'closed' || status === 'resolved') {
        stats.done++;
        stats.donePoints += points;
      } else if (status === 'in progress' || status === 'in review' || status === 'testing') {
        stats.inProgress++;
      } else {
        stats.todo++;
      }
    });

    return stats;
  }, [filteredIssues]);

  // Progress percentages
  const progressRate = useMemo(() => {
    const total = filteredIssues.length;
    if (total === 0) return 0;
    return Math.round((issueStats.done / total) * 100);
  }, [filteredIssues.length, issueStats.done]);

  const pointsProgressRate = useMemo(() => {
    if (issueStats.totalPoints === 0) return 0;
    return Math.round((issueStats.donePoints / issueStats.totalPoints) * 100);
  }, [issueStats.totalPoints, issueStats.donePoints]);

  const handleBoardChange = (boardId: string) => {
    if (boardId) {
      router.push(`/sprints?board=${boardId}`);
    } else {
      router.push('/sprints');
    }
  };

  const handleSprintSelect = (sprintId: number) => {
    router.push(`/sprints?board=${selectedBoardId}&sprint=${sprintId}&state=${stateFilter}`);
  };

  const handleStateFilter = (state: string) => {
    if (selectedBoardId) {
      const params = new URLSearchParams();
      params.set('board', selectedBoardId.toString());
      params.set('state', state);
      if (selectedSprintId) params.set('sprint', selectedSprintId.toString());
      router.push(`/sprints?${params.toString()}`);
    }
  };

  const toggleAssignee = (name: string) => {
    setSelectedAssignees(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const clearAssigneeFilter = () => {
    setSelectedAssignees(new Set());
  };

  const toggleComponent = (name: string) => {
    setSelectedComponents(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const clearComponentFilter = () => {
    setSelectedComponents(new Set());
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Controls: Board Selector + State Filter */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Board Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Board:</label>
          <select
            value={selectedBoardId?.toString() || ''}
            onChange={(e) => handleBoardChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">Select a board...</option>
            {boards.map(board => (
              <option key={board.id} value={board.id}>
                {board.name} ({board.type})
              </option>
            ))}
          </select>
        </div>

        {/* State Filter */}
        {selectedBoardId && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {['all', 'active', 'future', 'closed'].map(state => (
                <button
                  key={state}
                  onClick={() => handleStateFilter(state)}
                  className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    stateFilter === state
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No board selected */}
      {!selectedBoardId && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <div className="text-gray-400 mb-2">
            <Calendar className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">Select a Board</h3>
          <p className="text-gray-500 text-sm mt-1">
            Choose a board from the dropdown above to view sprints
          </p>
        </div>
      )}

      {/* Sprint Cards (horizontal scroll) */}
      {selectedBoardId && filteredSprints.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Sprints ({filteredSprints.length})
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredSprints.map(sprint => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                isSelected={sprint.id === selectedSprintId}
                onClick={() => handleSprintSelect(sprint.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No sprints */}
      {selectedBoardId && filteredSprints.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <p className="text-gray-500">No sprints found for this board</p>
        </div>
      )}

      {/* Selected Sprint Detail */}
      {selectedSprint && (
        <div className="space-y-6">
          {/* Sprint Header Card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedSprint.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedSprint.state === 'active'
                        ? 'bg-green-100 text-green-700'
                        : selectedSprint.state === 'future'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedSprint.state}
                    </span>
                    {isReadOnly && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                        Read-Only
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  {(selectedSprint.start_date || selectedSprint.end_date) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {selectedSprint.start_date
                          ? new Date(selectedSprint.start_date).toLocaleDateString('ko-KR')
                          : '?'}
                        <ChevronRight className="w-4 h-4 inline mx-1" />
                        {selectedSprint.end_date
                          ? new Date(selectedSprint.end_date).toLocaleDateString('ko-KR')
                          : '?'}
                      </span>
                    </div>
                  )}

                  {/* Goal */}
                  {selectedSprint.goal && (
                    <div className="mt-3 flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600 whitespace-pre-line">{selectedSprint.goal}</p>
                    </div>
                  )}
                </div>

                {/* Issue Stats */}
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400">{issueStats.todo}</div>
                    <div className="text-xs text-gray-500">To Do</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{issueStats.inProgress}</div>
                    <div className="text-xs text-gray-500">In Progress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{issueStats.done}</div>
                    <div className="text-xs text-gray-500">Done</div>
                  </div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="mt-6 space-y-3">
                {/* Issue Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Issue Progress</span>
                    <span className="font-medium text-gray-900">
                      {issueStats.done} / {filteredIssues.length} ({progressRate}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressRate}%` }}
                    />
                  </div>
                </div>

                {/* Points Progress */}
                {issueStats.totalPoints > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Story Points</span>
                      <span className="font-medium text-gray-900">
                        {issueStats.donePoints} / {issueStats.totalPoints} pts ({pointsProgressRate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${pointsProgressRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Burndown Chart */}
            {selectedSprint.start_date && selectedSprint.end_date && (
              <BurndownChart sprint={selectedSprint} issues={filteredIssues} />
            )}

            {/* Component Pie Chart */}
            <ComponentPieChart
              issues={filteredIssues}
              selectedComponents={selectedComponents}
              onComponentClick={toggleComponent}
            />
          </div>

          {/* Component Progress Chart */}
          <ComponentProgressChart
            issues={filteredIssues}
            selectedComponents={selectedComponents}
            onComponentClick={toggleComponent}
          />

          {/* Issues Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
              {/* Assignee Filter */}
              <div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowAssigneeFilter(!showAssigneeFilter)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <Users className="w-4 h-4" />
                    Assignee Filter
                    {selectedAssignees.size > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {selectedAssignees.size}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showAssigneeFilter ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {selectedAssignees.size > 0 && (
                    <button
                      onClick={clearAssigneeFilter}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showAssigneeFilter && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignees.map(({ name, count, avatarUrl }) => (
                      <label
                        key={name}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${
                          selectedAssignees.has(name)
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssignees.has(name)}
                          onChange={() => toggleAssignee(name)}
                          className="sr-only"
                        />
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="text-sm">{name}</span>
                        <span className="text-xs text-gray-500">({count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Component Filter */}
              <div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowComponentFilter(!showComponentFilter)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <Box className="w-4 h-4" />
                    Component Filter
                    {selectedComponents.size > 0 && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                        {selectedComponents.size}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showComponentFilter ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {selectedComponents.size > 0 && (
                    <button
                      onClick={clearComponentFilter}
                      className="text-sm text-orange-600 hover:text-orange-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showComponentFilter && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {components.map(({ name, count }) => (
                      <label
                        key={name}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${
                          selectedComponents.has(name)
                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedComponents.has(name)}
                          onChange={() => toggleComponent(name)}
                          className="sr-only"
                        />
                        <span className="text-sm">{name}</span>
                        <span className="text-xs text-gray-500">({count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-10"></th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-28">
                      <button
                        onClick={() => handleSort('key')}
                        className="flex items-center gap-1.5 hover:text-blue-600"
                      >
                        Key
                        <SortIcon field="key" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Summary</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-32">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1.5 hover:text-blue-600"
                      >
                        Status
                        <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-24">
                      <button
                        onClick={() => handleSort('points')}
                        className="flex items-center gap-1.5 hover:text-blue-600"
                      >
                        Points
                        <SortIcon field="points" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-40">
                      <button
                        onClick={() => handleSort('assignee')}
                        className="flex items-center gap-1.5 hover:text-blue-600"
                      >
                        Assignee
                        <SortIcon field="assignee" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedIssues.length > 0 ? (
                    sortedIssues.map(issue => (
                      <SprintIssueRow
                        key={issue.key}
                        issue={issue}
                        onSelect={setSelectedIssue}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        {issues.length > 0
                          ? 'No issues match the selected filters'
                          : 'No issues in this sprint'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sprint Documents Section */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">
                    Sprint Documents
                    {!isLoadingDocuments && sprintDocuments.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({sprintDocuments.length})
                      </span>
                    )}
                  </h3>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => setShowLabelEditor(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Edit Labels
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs text-gray-500">Labels:</span>
                <code className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {getSprintLabel(selectedSprint.name)}
                </code>
                {currentSprintLabels.map(label => (
                  <code key={label} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                    {label}
                  </code>
                ))}
              </div>
            </div>

            <div className="p-4">
              {isLoadingDocuments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sprintDocuments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sprintDocuments.map(page => (
                    <SprintDocumentCard
                      key={page.id}
                      page={page}
                      sprintLabel={getSprintLabel(selectedSprint.name)}
                      onClick={() => setSelectedDocument(page)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="mb-2">No documents found for this sprint</p>
                  <p className="text-xs">
                    Add the label &quot;{getSprintLabel(selectedSprint.name)}&quot; to Confluence pages to show them here
                  </p>
                </div>
              )}
            </div>
          </div>
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
      {selectedDocument && (
        <ConfluencePageModal
          page={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Sprint Label Editor Modal */}
      {!isReadOnly && showLabelEditor && selectedSprint && (
        <SprintLabelEditor
          sprint={{ ...selectedSprint, confluence_labels: currentSprintLabels }}
          autoGeneratedLabel={getSprintLabel(selectedSprint.name)}
          onClose={() => setShowLabelEditor(false)}
          onSaved={(updatedSprint) => {
            // Update local state with new labels
            const newLabels = updatedSprint.confluence_labels || [];
            setCurrentSprintLabels(newLabels);

            // Re-fetch documents with updated labels
            const sprintLabel = getSprintLabel(selectedSprint.name);
            const allLabels = [sprintLabel, ...newLabels];

            setIsLoadingDocuments(true);
            fetch(`/api/confluence/by-labels?labels=${encodeURIComponent(allLabels.join(','))}`)
              .then(res => res.ok ? res.json() : { pages: [] })
              .then(data => setSprintDocuments(data.pages || []))
              .catch(() => setSprintDocuments([]))
              .finally(() => setIsLoadingDocuments(false));
          }}
        />
      )}
    </div>
  );
}
