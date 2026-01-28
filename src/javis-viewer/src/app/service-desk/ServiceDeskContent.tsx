'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, RotateCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ServiceDeskTicketRow from '@/components/ServiceDeskTicketRow';
import {
  type BusinessUnit,
  type ServiceDeskResponse,
  type ServiceDeskTicket,
  type ServiceDeskPagination,
  BUSINESS_UNIT_LABELS,
  CHART_COLORS,
} from '@/types/service-desk';

interface Props {
  initialData: ServiceDeskResponse & {
    pagination?: ServiceDeskPagination;
    tabCounts?: Record<BusinessUnit, number>;
  };
}

// Custom hook for debounced value
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function ServiceDeskContent({ initialData }: Props) {
  const [activeTab, setActiveTab] = useState<BusinessUnit>('all');
  const [data, setData] = useState<ServiceDeskResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ServiceDeskPagination>(
    initialData.pagination || { page: 1, pageSize: 50, totalPages: 1, totalCount: initialData.stats.total }
  );

  // Tab counts from initial data
  const [tabCounts, setTabCounts] = useState<Record<BusinessUnit, number>>(
    initialData.tabCounts || {
      all: initialData.stats.total,
      'integrated-systems': 0,
      abatement: 0,
    }
  );

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  // Dropdown state for accessibility
  const [openDropdown, setOpenDropdown] = useState<'status' | 'assignee' | 'priority' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch data
  const fetchData = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);

    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const params = new URLSearchParams();
      params.set('businessUnit', activeTab);
      params.set('page', currentPage.toString());
      params.set('pageSize', '50');
      if (selectedStatuses.length > 0) params.set('status', selectedStatuses.join(','));
      if (selectedAssignees.length > 0) params.set('assignee', selectedAssignees.join(','));
      if (selectedPriorities.length > 0) params.set('priority', selectedPriorities.join(','));
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/service-desk?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      if (result.pagination) {
        setPagination(result.pagination);
      }
      if (result.tabCounts) {
        setTabCounts(result.tabCounts);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedStatuses, selectedAssignees, selectedPriorities, debouncedSearch, page]);

  // Fetch when filters change (reset to page 1)
  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedStatuses, selectedAssignees, selectedPriorities, debouncedSearch]);

  // Fetch when page changes (don't reset)
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  useEffect(() => {
    if (page !== 1) {
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const clearFilters = () => {
    setSearchInput('');
    setSelectedStatuses([]);
    setSelectedAssignees([]);
    setSelectedPriorities([]);
  };

  const hasActiveFilters = searchInput || selectedStatuses.length > 0 || selectedAssignees.length > 0 || selectedPriorities.length > 0;

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleAssignee = (accountId: string) => {
    setSelectedAssignees(prev =>
      prev.includes(accountId) ? prev.filter(a => a !== accountId) : [...prev, accountId]
    );
  };

  const togglePriority = (priority: string) => {
    setSelectedPriorities(prev =>
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  };

  const toggleDropdown = (dropdown: 'status' | 'assignee' | 'priority') => {
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const { stats, tickets, filterOptions } = data;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => fetchData(false)}
            className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'integrated-systems', 'abatement'] as BusinessUnit[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === tab
                ? 'text-rose-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {BUSINESS_UNIT_LABELS[tab]} ({tabCounts[tab]})
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600" />
            )}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500 mt-1">Total Tickets</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-3xl font-bold text-red-600">{stats.open}</div>
          <div className="text-sm text-gray-500 mt-1">Open</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-sm text-gray-500 mt-1">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-3xl font-bold text-green-600">{stats.resolvedPercent}%</div>
          <div className="text-sm text-gray-500 mt-1">Resolved</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Status Distribution</h3>
          <div className="h-64">
            {stats.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {stats.byStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Component Bar Chart */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Tickets by Component</h3>
          <div className="h-64">
            {stats.byComponent.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.byComponent.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="component" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm" ref={dropdownRef}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by key or summary..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('status')}
              onKeyDown={(e) => e.key === 'Enter' && toggleDropdown('status')}
              aria-expanded={openDropdown === 'status'}
              aria-haspopup="listbox"
              className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-2 ${
                selectedStatuses.length > 0 ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Status
              {selectedStatuses.length > 0 && (
                <span className="bg-rose-600 text-white text-xs px-1.5 rounded-full">
                  {selectedStatuses.length}
                </span>
              )}
            </button>
            {openDropdown === 'status' && (
              <div
                role="listbox"
                className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 min-w-[160px]"
              >
                {filterOptions.statuses.map(status => (
                  <label key={status} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span className="text-sm">{status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Assignee Filter */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('assignee')}
              onKeyDown={(e) => e.key === 'Enter' && toggleDropdown('assignee')}
              aria-expanded={openDropdown === 'assignee'}
              aria-haspopup="listbox"
              className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-2 ${
                selectedAssignees.length > 0 ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Assignee
              {selectedAssignees.length > 0 && (
                <span className="bg-rose-600 text-white text-xs px-1.5 rounded-full">
                  {selectedAssignees.length}
                </span>
              )}
            </button>
            {openDropdown === 'assignee' && (
              <div
                role="listbox"
                className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 min-w-[200px] max-h-64 overflow-y-auto"
              >
                {filterOptions.assignees.map(assignee => (
                  <label key={assignee.accountId} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes(assignee.accountId)}
                      onChange={() => toggleAssignee(assignee.accountId)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span className="text-sm">{assignee.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('priority')}
              onKeyDown={(e) => e.key === 'Enter' && toggleDropdown('priority')}
              aria-expanded={openDropdown === 'priority'}
              aria-haspopup="listbox"
              className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-2 ${
                selectedPriorities.length > 0 ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Priority
              {selectedPriorities.length > 0 && (
                <span className="bg-rose-600 text-white text-xs px-1.5 rounded-full">
                  {selectedPriorities.length}
                </span>
              )}
            </button>
            {openDropdown === 'priority' && (
              <div
                role="listbox"
                className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 min-w-[140px]"
              >
                {filterOptions.priorities.map(priority => (
                  <label key={priority} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPriorities.includes(priority)}
                      onChange={() => togglePriority(priority)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span className="text-sm">{priority}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            aria-label="Refresh data"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {searchInput && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                Search: {searchInput}
                <button onClick={() => setSearchInput('')} className="hover:text-gray-900" aria-label="Remove search filter">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatuses.map(status => (
              <span key={status} className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                {status}
                <button onClick={() => toggleStatus(status)} className="hover:text-rose-900" aria-label={`Remove ${status} filter`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedAssignees.map(accountId => {
              const assignee = filterOptions.assignees.find(a => a.accountId === accountId);
              return (
                <span key={accountId} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {assignee?.displayName || accountId}
                  <button onClick={() => toggleAssignee(accountId)} className="hover:text-blue-900" aria-label={`Remove ${assignee?.displayName || accountId} filter`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {selectedPriorities.map(priority => (
              <span key={priority} className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                {priority}
                <button onClick={() => togglePriority(priority)} className="hover:text-amber-900" aria-label={`Remove ${priority} filter`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results Info & Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing <span className="font-semibold text-gray-700">{tickets.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{pagination.totalCount}</span> tickets
        </span>

        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.totalPages || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700 w-10"></th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-28">Key</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Summary</th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-32">Reporter</th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-32">Assignee</th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-28">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-24">Priority</th>
                <th className="px-4 py-3 font-semibold text-gray-700 w-28">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : tickets.length > 0 ? (
                tickets.map((ticket: ServiceDeskTicket) => (
                  <ServiceDeskTicketRow key={ticket.key} ticket={ticket} />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`px-3 py-1 border rounded-lg text-sm ${
                    page === pageNum
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.totalPages || loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
