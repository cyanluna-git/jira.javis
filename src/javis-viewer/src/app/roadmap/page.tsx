'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Map,
  Plus,
  Target,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  FolderKanban,
} from 'lucide-react';
import { NavigationButtons } from '@/components/NavigationButtons';
import VisionCard from '@/components/VisionCard';
import MilestoneCard from '@/components/MilestoneCard';
import type { Vision, RoadmapSummary, QuarterlyMilestones, MilestoneWithStreams } from '@/types/roadmap';

interface VisionWithAggregates extends Vision {
  milestone_count: number;
  completed_milestones: number;
  overall_progress: number;
}

export default function RoadmapPage() {
  const [visions, setVisions] = useState<VisionWithAggregates[]>([]);
  const [quarterlyMilestones, setQuarterlyMilestones] = useState<QuarterlyMilestones[]>([]);
  const [summary, setSummary] = useState<RoadmapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewVisionModal, setShowNewVisionModal] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, visionsRes, milestonesRes] = await Promise.all([
        fetch('/api/roadmap/visions?summary=true'),
        fetch('/api/roadmap/visions'),
        fetch('/api/roadmap/milestones?group_by_quarter=true'),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (visionsRes.ok) setVisions(await visionsRes.json());
      if (milestonesRes.ok) setQuarterlyMilestones(await milestonesRes.json());
    } catch (error) {
      console.error('Error fetching roadmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter visions - now filter by vision title (project name) instead of Jira project_key
  const filteredVisions = visions.filter(v => {
    if (filterProject && v.title !== filterProject) return false;
    if (filterStatus && v.status !== filterStatus) return false;
    return true;
  });

  // Get unique project names (vision titles)
  const projectNames = visions.map(v => v.title);

  // New vision form
  const [newVision, setNewVision] = useState({
    project_key: '',
    title: '',
    description: '',
    north_star_metric: '',
    north_star_target: '',
    target_date: '',
    jql_filter: '',
  });

  const handleCreateVision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/roadmap/visions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVision,
          north_star_target: newVision.north_star_target ? Number(newVision.north_star_target) : null,
          jql_filter: newVision.jql_filter || null,
        }),
      });

      if (res.ok) {
        setShowNewVisionModal(false);
        setNewVision({ project_key: '', title: '', description: '', north_star_metric: '', north_star_target: '', target_date: '', jql_filter: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating vision:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NavigationButtons />
              <Map className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Roadmap</h1>
                <p className="text-sm text-gray-500">Vision / Milestone / Stream</p>
              </div>
            </div>

            <button
              onClick={() => setShowNewVisionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Vision
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Target className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.total_milestones}</div>
                  <div className="text-sm text-gray-500">Total Milestones</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.milestones_by_status.in_progress}</div>
                  <div className="text-sm text-gray-500">In Progress</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.milestones_by_status.completed}</div>
                  <div className="text-sm text-gray-500">Completed</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{summary.milestones_at_risk}</div>
                  <div className="text-sm text-gray-500">At Risk</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FolderKanban className="w-4 h-4" />
            <span>Project:</span>
          </div>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Projects</option>
            {projectNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="achieved">Achieved</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Visions Grid */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visions</h2>
          {filteredVisions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No visions yet. Create your first vision to start planning.</p>
              <button
                onClick={() => setShowNewVisionModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Create Vision
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredVisions.map((vision) => (
                <VisionCard key={vision.id} vision={vision} />
              ))}
            </div>
          )}
        </section>

        {/* Quarterly Milestones */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones by Quarter</h2>
          {quarterlyMilestones.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No milestones yet. Add milestones to your visions.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {quarterlyMilestones.map((quarter) => (
                <div key={quarter.quarter}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-md font-medium text-gray-700">{quarter.quarter}</h3>
                    <span className="text-sm text-gray-400">({quarter.milestones.length} milestones)</span>
                  </div>
                  <div className="space-y-3">
                    {quarter.milestones.map((milestone) => (
                      <MilestoneCard
                        key={milestone.id}
                        milestone={milestone}
                        showVisionTitle={true}
                        onEpicLinked={fetchData}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* New Vision Modal */}
      {showNewVisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Vision</h2>
            </div>
            <form onSubmit={handleCreateVision} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Key *</label>
                  <input
                    type="text"
                    required
                    value={newVision.project_key}
                    onChange={(e) => setNewVision({ ...newVision, project_key: e.target.value.toUpperCase() })}
                    placeholder="EUV"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={newVision.target_date}
                    onChange={(e) => setNewVision({ ...newVision, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vision Title *</label>
                <input
                  type="text"
                  required
                  value={newVision.title}
                  onChange={(e) => setNewVision({ ...newVision, title: e.target.value })}
                  placeholder="예: 자율 운영 시스템 구축"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newVision.description}
                  onChange={(e) => setNewVision({ ...newVision, description: e.target.value })}
                  rows={3}
                  placeholder="비전에 대한 상세 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">North Star Metric</label>
                  <input
                    type="text"
                    value={newVision.north_star_metric}
                    onChange={(e) => setNewVision({ ...newVision, north_star_metric: e.target.value })}
                    placeholder="예: 월간 활성 사용자"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                  <input
                    type="number"
                    value={newVision.north_star_target}
                    onChange={(e) => setNewVision({ ...newVision, north_star_target: e.target.value })}
                    placeholder="10000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JQL Filter</label>
                <input
                  type="text"
                  value={newVision.jql_filter}
                  onChange={(e) => setNewVision({ ...newVision, jql_filter: e.target.value })}
                  placeholder='예: project = EUV AND component = "OQC Digitalization"'
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">이 프로젝트에 해당하는 이슈를 필터링하는 JQL</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewVisionModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Vision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
