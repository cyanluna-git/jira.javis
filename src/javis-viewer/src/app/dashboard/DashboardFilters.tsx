'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { Filter, Calendar, FolderKanban } from 'lucide-react';

interface Project {
  key: string;
  name: string;
}

interface Props {
  projects: Project[];
  selectedProject: string | null;
  selectedDays: number | null;
}

const DATE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
  { value: '365', label: 'Last Year' },
];

export default function DashboardFilters({
  projects,
  selectedProject,
  selectedDays,
}: Props) {
  const router = useRouter();

  const handleFilterChange = useCallback((type: 'project' | 'days', value: string) => {
    const params = new URLSearchParams();

    if (type === 'project') {
      if (value) params.set('project', value);
      if (selectedDays) params.set('days', String(selectedDays));
    } else {
      if (selectedProject) params.set('project', selectedProject);
      if (value) params.set('days', value);
    }

    const queryString = params.toString();
    router.push(`/dashboard${queryString ? `?${queryString}` : ''}`);
  }, [selectedProject, selectedDays, router]);

  const clearFilters = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const hasFilters = selectedProject || selectedDays;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-gray-400" />
          <select
            value={selectedProject || ''}
            onChange={(e) => handleFilterChange('project', e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 min-w-[150px]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={selectedDays?.toString() || ''}
            onChange={(e) => handleFilterChange('days', e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 min-w-[140px]"
          >
            {DATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}

        {/* Active Filter Tags */}
        {hasFilters && (
          <div className="flex items-center gap-2 ml-auto">
            {selectedProject && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                <FolderKanban className="w-3 h-3" />
                {selectedProject}
              </span>
            )}
            {selectedDays && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                <Calendar className="w-3 h-3" />
                {DATE_OPTIONS.find(o => o.value === String(selectedDays))?.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
