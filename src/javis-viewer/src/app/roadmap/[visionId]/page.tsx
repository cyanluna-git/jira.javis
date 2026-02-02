'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  Target,
  Calendar,
  Edit,
  Plus,
  Save,
  X,
  CheckCircle,
  Clock,
  Archive,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import MilestoneCard from '@/components/MilestoneCard';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import EpicIssueTree from '@/components/EpicIssueTree';
import VisionMemberSection from '@/components/VisionMemberSection';
import { useReadOnly } from '@/contexts/ReadOnlyContext';
import type {
  VisionWithMilestones,
  VisionStatus,
  CreateMilestoneInput,
  MilestoneStatus,
  RiskLevel,
  VisionIssuesResponse,
  EpicWithIssues,
} from '@/types/roadmap';

interface PageProps {
  params: Promise<{ visionId: string }>;
}

const statusConfig: Record<VisionStatus, { icon: React.ReactNode; color: string; label: string }> = {
  active: { icon: <Clock className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Active' },
  achieved: { icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-100 text-green-700 border-green-200', label: 'Achieved' },
  archived: { icon: <Archive className="w-5 h-5" />, color: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Archived' },
};

export default function VisionDetailPage({ params }: PageProps) {
  const { visionId } = use(params);
  const router = useRouter();
  const isReadOnly = useReadOnly();

  const [vision, setVision] = useState<VisionWithMilestones | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showNewMilestoneModal, setShowNewMilestoneModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [issuesData, setIssuesData] = useState<VisionIssuesResponse | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    north_star_metric: '',
    north_star_target: '',
    north_star_current: '',
    target_date: '',
    status: 'active' as VisionStatus,
  });

  // New milestone form state
  const [newMilestone, setNewMilestone] = useState<CreateMilestoneInput>({
    vision_id: visionId,
    title: '',
    description: '',
    quarter: '',
    status: 'planned',
    risk_level: 'low',
    target_start: '',
    target_end: '',
  });

  const fetchVision = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}`);
      if (res.ok) {
        const data = await res.json();
        setVision(data);
        setEditForm({
          title: data.title,
          description: data.description || '',
          north_star_metric: data.north_star_metric || '',
          north_star_target: data.north_star_target?.toString() || '',
          north_star_current: data.north_star_current?.toString() || '',
          target_date: data.target_date || '',
          status: data.status,
        });
      } else {
        router.push('/roadmap');
      }
    } catch (error) {
      console.error('Error fetching vision:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}/issues`);
      if (res.ok) {
        const data = await res.json();
        setIssuesData(data);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoadingIssues(false);
    }
  };

  useEffect(() => {
    fetchVision();
    fetchIssues();
  }, [visionId]);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          north_star_target: editForm.north_star_target ? Number(editForm.north_star_target) : null,
          north_star_current: editForm.north_star_current ? Number(editForm.north_star_current) : null,
          target_date: editForm.target_date || null,
        }),
      });

      if (res.ok) {
        setEditing(false);
        fetchVision();
      }
    } catch (error) {
      console.error('Error updating vision:', error);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this vision?')) return;

    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/roadmap');
      }
    } catch (error) {
      console.error('Error archiving vision:', error);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/roadmap/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMilestone,
          vision_id: visionId,
          target_start: newMilestone.target_start || null,
          target_end: newMilestone.target_end || null,
        }),
      });

      if (res.ok) {
        setShowNewMilestoneModal(false);
        setNewMilestone({
          vision_id: visionId,
          title: '',
          description: '',
          quarter: '',
          status: 'planned',
          risk_level: 'low',
          target_start: '',
          target_end: '',
        });
        fetchVision();
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
    }
  };

  const handleSyncEpics = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/roadmap/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Synced ${result.synced} epic(s), updated ${result.milestones_updated} milestone(s)`);
        fetchVision();
      } else {
        alert('Failed to sync epics');
      }
    } catch (error) {
      console.error('Error syncing epics:', error);
      alert('Error syncing epics');
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !vision) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const statusInfo = statusConfig[vision.status];
  const northStarProgress = vision.north_star_target && vision.north_star_current
    ? Math.round((vision.north_star_current / vision.north_star_target) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Link
                  href="/roadmap"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <Link
                  href="/"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Home className="w-5 h-5 text-gray-600" />
                </Link>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {vision.project_key}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 border ${statusInfo.color}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                  {isReadOnly && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                      Read-Only
                    </span>
                  )}
                </div>
                {editing ? (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="mt-1 text-2xl font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 mt-1">{vision.title}</h1>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </>
              ) : !isReadOnly ? (
                <>
                  <button
                    onClick={handleSyncEpics}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-2 text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Epics'}
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleArchive}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Vision Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
            {editing ? (
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={10}
                placeholder="마크다운 형식을 지원합니다. (# 헤딩, **볼드**, *이탤릭*, - 리스트 등)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            ) : (
              <div className="text-gray-700 prose prose-sm max-w-none">
                <MarkdownRenderer content={vision.description} />
              </div>
            )}
          </div>

          {/* North Star Metric */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-indigo-700">North Star Metric</span>
            </div>

            {editing ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Metric Name</label>
                  <input
                    type="text"
                    value={editForm.north_star_metric}
                    onChange={(e) => setEditForm({ ...editForm, north_star_metric: e.target.value })}
                    placeholder="Monthly Active Users"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Current Value</label>
                  <input
                    type="number"
                    value={editForm.north_star_current}
                    onChange={(e) => setEditForm({ ...editForm, north_star_current: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Target Value</label>
                  <input
                    type="number"
                    value={editForm.north_star_target}
                    onChange={(e) => setEditForm({ ...editForm, north_star_target: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : vision.north_star_metric ? (
              <div>
                <div className="text-lg font-medium text-gray-900 mb-4">{vision.north_star_metric}</div>
                {northStarProgress !== null && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Current: {vision.north_star_current?.toLocaleString()}</span>
                      <span>Target: {vision.north_star_target?.toLocaleString()}</span>
                    </div>
                    <div className="h-4 bg-white rounded-full overflow-hidden border border-indigo-200">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.min(northStarProgress, 100)}%` }}
                      />
                    </div>
                    <div className="text-center text-lg font-bold text-indigo-600 mt-2">
                      {northStarProgress}% achieved
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">No north star metric defined</div>
            )}
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Date</label>
              {editing ? (
                <input
                  type="date"
                  value={editForm.target_date}
                  onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4" />
                  {vision.target_date
                    ? new Date(vision.target_date).toLocaleDateString('ko-KR')
                    : 'Not set'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              {editing ? (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as VisionStatus })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="achieved">Achieved</option>
                  <option value="archived">Archived</option>
                </select>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${statusInfo.color}`}>
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Milestones</label>
              <div className="text-gray-700">
                {vision.completed_milestones}/{vision.milestone_count} completed
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Overall Progress</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${vision.overall_progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{Math.round(vision.overall_progress)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="mb-6">
          <VisionMemberSection visionId={visionId} />
        </div>

        {/* Milestones Section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Milestones</h2>
          {!isReadOnly && (
            <button
              onClick={() => setShowNewMilestoneModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          )}
        </div>

        {vision.milestones.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No milestones yet. {!isReadOnly && 'Add your first milestone to track progress.'}</p>
            {!isReadOnly && (
              <button
                onClick={() => setShowNewMilestoneModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Add Milestone
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {vision.milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} onEpicLinked={fetchVision} />
            ))}
          </div>
        )}

        {/* Project Issues Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Project Issues</h2>
            <button
              onClick={fetchIssues}
              disabled={loadingIssues}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingIssues ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* JQL Filter Display */}
          {issuesData?.jql_filter && (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span className="font-medium">JQL Filter:</span>
              </div>
              <code className="text-sm text-gray-700 font-mono">{issuesData.jql_filter}</code>
            </div>
          )}

          {loadingIssues ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : issuesData ? (
            <div className="space-y-6">
              {/* Linked Epics - Grouped by Milestone */}
              {issuesData.linked_epics.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Linked Epics ({issuesData.linked_epics.length})
                  </h3>
                  <div className="space-y-2">
                    {/* Group by Milestone */}
                    {(() => {
                      const groupedByMilestone = issuesData.linked_epics.reduce((acc, epic) => {
                        const milestoneTitle = epic.milestone_title || 'Unknown Milestone';
                        if (!acc[milestoneTitle]) {
                          acc[milestoneTitle] = [];
                        }
                        acc[milestoneTitle].push(epic);
                        return acc;
                      }, {} as Record<string, EpicWithIssues[]>);

                      return Object.entries(groupedByMilestone).map(([milestoneTitle, epics]) => (
                        <div key={milestoneTitle} className="mb-4">
                          <div className="text-sm font-medium text-purple-700 mb-2 pl-2 border-l-2 border-purple-300">
                            {milestoneTitle}
                          </div>
                          <div className="space-y-2">
                            {epics.map((epic) => (
                              <EpicIssueTree
                                key={epic.key}
                                epic={epic}
                                jiraUrl={process.env.NEXT_PUBLIC_JIRA_URL}
                              />
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Unlinked Epics */}
              {issuesData.unlinked_epics.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Unlinked Epics ({issuesData.unlinked_epics.length})
                    <span className="text-xs text-gray-400 font-normal">- Link to a Milestone for better tracking</span>
                  </h3>
                  <div className="space-y-2">
                    {issuesData.unlinked_epics.map((epic) => (
                      <EpicIssueTree
                        key={epic.key}
                        epic={epic}
                        jiraUrl={process.env.NEXT_PUBLIC_JIRA_URL}
                        onLinkToMilestone={(epicKey) => {
                          alert(`TODO: Open modal to link ${epicKey} to a milestone`);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {issuesData.linked_epics.length === 0 && issuesData.unlinked_epics.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No epics found for this project.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Unable to load issues. Try refreshing.</p>
            </div>
          )}
        </div>
      </main>

      {/* New Milestone Modal */}
      {!isReadOnly && showNewMilestoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Milestone</h2>
            </div>
            <form onSubmit={handleCreateMilestone} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={newMilestone.title}
                  onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                  placeholder="예: MVP 출시"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newMilestone.description || ''}
                  onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                  rows={2}
                  placeholder="마일스톤에 대한 상세 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                  <input
                    type="text"
                    value={newMilestone.quarter || ''}
                    onChange={(e) => setNewMilestone({ ...newMilestone, quarter: e.target.value })}
                    placeholder="2026-Q1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newMilestone.status}
                    onChange={(e) => setNewMilestone({ ...newMilestone, status: e.target.value as MilestoneStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                  <select
                    value={newMilestone.risk_level}
                    onChange={(e) => setNewMilestone({ ...newMilestone, risk_level: e.target.value as RiskLevel })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={typeof newMilestone.target_start === 'string' ? newMilestone.target_start : ''}
                    onChange={(e) => setNewMilestone({ ...newMilestone, target_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={typeof newMilestone.target_end === 'string' ? newMilestone.target_end : ''}
                    onChange={(e) => setNewMilestone({ ...newMilestone, target_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewMilestoneModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
