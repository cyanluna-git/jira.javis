'use client';

import { useEffect, useState, useMemo } from 'react';
import { BookOpen, CheckCircle2, Clock, FileText, Package, PlayCircle, Search } from 'lucide-react';
import BundleRow from '@/components/BundleRow';
import BundleCharts from './BundleCharts';
import type { Bundle, BundleResponse, BundleStats } from '@/types/bundle';
import { GENERATION_LABELS } from '@/types/bundle';

type GenerationFilter = 'all' | 'gen2' | 'gen3';
type StatusFilter = 'all' | 'active' | 'planning' | 'completed';

export default function BundleContent() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generationFilter, setGenerationFilter] = useState<GenerationFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch bundles data
  useEffect(() => {
    async function fetchBundles() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (generationFilter !== 'all') params.set('generation', generationFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (searchQuery) params.set('search', searchQuery);

        const res = await fetch(`/api/bundles?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch bundles');

        const data: BundleResponse = await res.json();
        setBundles(data.bundles);
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchBundles();
  }, [generationFilter, statusFilter, searchQuery]);

  // Filter bundles locally for instant search feedback
  const filteredBundles = useMemo(() => {
    if (!searchQuery) return bundles;
    const query = searchQuery.toLowerCase();
    return bundles.filter(b =>
      b.summary.toLowerCase().includes(query) ||
      b.version.toLowerCase().includes(query) ||
      b.key.toLowerCase().includes(query)
    );
  }, [bundles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Generation Tabs */}
      <div className="flex gap-2">
        <TabButton
          active={generationFilter === 'all'}
          onClick={() => setGenerationFilter('all')}
        >
          All
        </TabButton>
        <TabButton
          active={generationFilter === 'gen2'}
          onClick={() => setGenerationFilter('gen2')}
        >
          {GENERATION_LABELS.gen2}
        </TabButton>
        <TabButton
          active={generationFilter === 'gen3'}
          onClick={() => setGenerationFilter('gen3')}
        >
          {GENERATION_LABELS.gen3}
        </TabButton>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Package className="w-5 h-5" />}
            label="Total"
            value={stats.total}
            color="text-gray-600"
            bgColor="bg-gray-100"
          />
          <StatCard
            icon={<PlayCircle className="w-5 h-5" />}
            label="Active"
            value={stats.active}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Planning"
            value={stats.planning}
            color="text-amber-600"
            bgColor="bg-amber-100"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Completed"
            value={stats.completed}
            color="text-green-600"
            bgColor="bg-green-100"
          />
        </div>
      )}

      {/* Charts */}
      {stats && filteredBundles.length > 0 && (
        <BundleCharts bundles={filteredBundles} stats={stats} />
      )}

      <details className="bg-blue-50 border border-blue-200 rounded-lg group">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-medium text-blue-900">How bundle collection works</div>
              <div className="text-sm text-blue-700">
                Rules for collecting bundle stories and Confluence pages
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-blue-600 group-open:hidden">Show rules</span>
          <span className="text-xs font-medium text-blue-600 hidden group-open:inline">Hide rules</span>
        </summary>

        <div className="px-4 pb-4 grid gap-4 lg:grid-cols-2">
          <div className="bg-white border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-violet-600" />
              <h3 className="font-medium text-gray-900">Bundle stories</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
              <li>Only EUV non-Epic issues are collected into a bundle.</li>
              <li>
                The bundle version is extracted from the Epic title like <code className="bg-gray-100 px-1 rounded">Bundle 3.10.0</code>.
              </li>
              <li>
                A story appears only when its Jira <code className="bg-gray-100 px-1 rounded">fixVersions</code> includes the exact version name, such as <code className="bg-gray-100 px-1 rounded">3.10.0</code>.
              </li>
              <li>
                Epic Link or parent relation alone does not make the story show up on this page.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <h3 className="font-medium text-gray-900">Confluence pages</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
              <li>Only Confluence pages are collected as related documents.</li>
              <li>
                A page is linked when it has the bundle label, such as <code className="bg-gray-100 px-1 rounded">bundle-3-10-0</code>.
              </li>
              <li>
                It is also linked when the page title matches the bundle version, for example <code className="bg-gray-100 px-1 rounded">3.10.0</code>, <code className="bg-gray-100 px-1 rounded">B3.10.0</code>, or <code className="bg-gray-100 px-1 rounded">Bundle 3.10.0</code>.
              </li>
              <li>
                Confluence page tree position is not used for bundle matching.
              </li>
            </ul>
          </div>
        </div>
      </details>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bundles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="planning">Planning</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Bundle Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No bundles found
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
            <div className="col-span-4">Bundle</div>
            <div className="col-span-3">Progress</div>
            <div className="col-span-2 text-center">Issues</div>
            <div className="col-span-1 text-center">Docs</div>
            <div className="col-span-2 text-center">Status</div>
          </div>

          {/* Bundle Rows */}
          <div className="divide-y divide-gray-100">
            {filteredBundles.map((bundle) => (
              <BundleRow key={bundle.key} bundle={bundle} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
