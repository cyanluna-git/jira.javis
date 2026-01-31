'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  User,
  Trophy,
  Target,
  Bug,
  Star,
  Clock,
  TrendingUp,
  Edit3,
  FileText,
  History,
  Award,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import EvaluationModal from '@/components/EvaluationModal';
import type { MemberDetail, MemberStats, MemberStatHistory, ManagerEvaluation } from '@/types/member';

interface Props {
  memberId: string;
}

const roleColors: Record<string, string> = {
  developer: 'bg-blue-100 text-blue-700',
  lead: 'bg-purple-100 text-purple-700',
  tester: 'bg-green-100 text-green-700',
  designer: 'bg-pink-100 text-pink-700',
  pm: 'bg-orange-100 text-orange-700',
};

function StatBar({ label, value, max = 100, color = 'blue' }: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const percentage = Math.min(100, (value / max) * 100);
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function MemberDetailClient({ memberId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'evaluations'>('stats');

  const fetchMember = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/members/${memberId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Member not found');
        }
        throw new Error('Failed to fetch member');
      }

      const detail: MemberDetail = await response.json();
      setData(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load member'}</p>
          <button
            onClick={() => router.push('/members')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Members
          </button>
        </div>
      </div>
    );
  }

  const { member, cumulative_stats, sprint_stats, recent_history, evaluations } = data;
  const stats = cumulative_stats ? {
    stories_completed: Number(cumulative_stats.stories_completed) || 0,
    story_points_earned: Number(cumulative_stats.story_points_earned) || 0,
    bugs_fixed: Number(cumulative_stats.bugs_fixed) || 0,
    tasks_completed: Number(cumulative_stats.tasks_completed) || 0,
    on_time_delivery: Number(cumulative_stats.on_time_delivery) || 0,
    late_delivery: Number(cumulative_stats.late_delivery) || 0,
    development_score: Number(cumulative_stats.development_score) || 50,
    review_score: Number(cumulative_stats.review_score) || 50,
    testing_score: Number(cumulative_stats.testing_score) || 50,
    collaboration_score: Number(cumulative_stats.collaboration_score) || 50,
    contribution_score: Number(cumulative_stats.contribution_score) || 50,
    maturity_level: Number(cumulative_stats.maturity_level) || 1,
  } : {
    stories_completed: 0,
    story_points_earned: 0,
    bugs_fixed: 0,
    tasks_completed: 0,
    on_time_delivery: 0,
    late_delivery: 0,
    development_score: 50,
    review_score: 50,
    testing_score: 50,
    collaboration_score: 50,
    contribution_score: 50,
    maturity_level: 1,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/members')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <Link
                href="/"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Member Detail</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.display_name}
                    className="w-24 h-24 rounded-full mx-auto mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                <h2 className="text-xl font-bold text-gray-900">{member.display_name}</h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[member.role]}`}>
                    {member.role}
                  </span>
                  {member.team && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                      {member.team}
                    </span>
                  )}
                </div>

                {member.email && (
                  <p className="text-sm text-gray-500 mt-3">{member.email}</p>
                )}
              </div>

              {/* Level Badge */}
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full">
                  <Trophy className="w-5 h-5" />
                  <span className="font-bold">Level {stats.maturity_level}</span>
                </div>
              </div>

              {/* Contribution Score */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Contribution Score</span>
                  <span className="text-2xl font-bold text-gray-900">{stats.contribution_score.toFixed(1)}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                    style={{ width: `${Math.min(100, stats.contribution_score)}%` }}
                  />
                </div>
              </div>

              {/* Skills */}
              {member.skills && member.skills.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowEvalModal(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  Add Evaluation
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Tabs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
                  <Target className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.stories_completed}</div>
                <div className="text-xs text-gray-500">Stories</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                  <Star className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.story_points_earned}</div>
                <div className="text-xs text-gray-500">Points</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
                  <Bug className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.bugs_fixed}</div>
                <div className="text-xs text-gray-500">Bugs Fixed</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.on_time_delivery}/{(stats.on_time_delivery || 0) + (stats.late_delivery || 0)}
                </div>
                <div className="text-xs text-gray-500">On Time</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex border-b border-gray-200">
                {[
                  { id: 'stats', label: 'Stats', icon: TrendingUp },
                  { id: 'history', label: 'History', icon: History },
                  { id: 'evaluations', label: 'Evaluations', icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'stats' && (
                  <div className="space-y-6">
                    {/* Skill Scores */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Skill Ratings</h3>
                      <div className="space-y-4">
                        <StatBar label="Development" value={stats.development_score} color="blue" />
                        <StatBar label="Code Review" value={stats.review_score} color="green" />
                        <StatBar label="Testing" value={stats.testing_score} color="purple" />
                        <StatBar label="Collaboration" value={stats.collaboration_score} color="yellow" />
                      </div>
                    </div>

                    {/* Sprint Stats */}
                    {sprint_stats.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Sprints</h3>
                        <div className="space-y-2">
                          {sprint_stats.slice(0, 5).map((ss) => (
                            <div
                              key={ss.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm font-medium text-gray-700">
                                {(ss as MemberStats & { sprint_name?: string }).sprint_name || `Sprint ${ss.period_id}`}
                              </span>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-500">
                                  {ss.stories_completed} stories
                                </span>
                                <span className="font-medium text-blue-600">
                                  {ss.story_points_earned} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-3">
                    {recent_history.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No history yet</p>
                    ) : (
                      recent_history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {h.stat_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {h.trigger_type} - {h.trigger_ref || 'N/A'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-sm font-medium ${
                                (h.delta || 0) > 0 ? 'text-green-600' : (h.delta || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}
                            >
                              {(h.delta || 0) > 0 ? '+' : ''}{h.delta}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(h.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'evaluations' && (
                  <div className="space-y-4">
                    {evaluations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">No evaluations yet</p>
                        <button
                          onClick={() => setShowEvalModal(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Add First Evaluation
                        </button>
                      </div>
                    ) : (
                      evaluations.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-900">{ev.evaluation_period}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(ev.evaluated_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex gap-4 mb-3">
                            {[
                              { label: 'Technical', value: ev.technical_skill },
                              { label: 'Communication', value: ev.communication },
                              { label: 'Problem Solving', value: ev.problem_solving },
                              { label: 'Initiative', value: ev.initiative },
                              { label: 'Teamwork', value: ev.teamwork },
                            ].map((item) => (
                              <div key={item.label} className="text-center">
                                <div className="text-lg font-bold text-gray-900">
                                  {item.value || '-'}
                                </div>
                                <div className="text-xs text-gray-500">{item.label}</div>
                              </div>
                            ))}
                          </div>

                          {ev.strengths && (
                            <div className="text-sm">
                              <span className="font-medium text-green-700">Strengths:</span>
                              <span className="text-gray-600 ml-2">{ev.strengths}</span>
                            </div>
                          )}
                          {ev.improvements && (
                            <div className="text-sm mt-1">
                              <span className="font-medium text-orange-700">Improvements:</span>
                              <span className="text-gray-600 ml-2">{ev.improvements}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Evaluation Modal */}
      {showEvalModal && (
        <EvaluationModal
          member={member}
          evaluatorId="manager" // TODO: Replace with actual logged-in user
          onClose={() => setShowEvalModal(false)}
          onSaved={() => {
            setShowEvalModal(false);
            fetchMember();
          }}
        />
      )}
    </div>
  );
}
