'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Trophy,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Target,
  Star,
  ChevronDown
} from 'lucide-react';
import { NavigationButtons } from '@/components/NavigationButtons';
import MemberStatCard from '@/components/MemberStatCard';
import type { MemberRanking, MemberRole } from '@/types/member';

type ViewMode = 'ranking' | 'all';
type RoleFilter = 'all' | MemberRole;

export default function MemberDashboard() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (viewMode === 'ranking') {
        params.set('ranking', 'true');
      }
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }
      params.set('active', 'true');

      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [viewMode, roleFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.display_name.toLowerCase().includes(query) ||
      member.team?.toLowerCase().includes(query) ||
      member.skills?.some((s) => s.toLowerCase().includes(query))
    );
  });

  const handleMemberClick = (memberId: string) => {
    router.push(`/members/${memberId}`);
  };

  // Stats summary (convert strings to numbers since PostgreSQL NUMERIC returns strings)
  const totalPoints = members.reduce((sum, m) => sum + (Number(m.total_points) || 0), 0);
  const totalStories = members.reduce((sum, m) => sum + (Number(m.total_stories) || 0), 0);
  const avgScore = members.length
    ? members.reduce((sum, m) => sum + (Number(m.contribution_score) || 0), 0) / members.length
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <NavigationButtons />
              <Users className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Team Members</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchMembers}
                disabled={loading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="text-2xl font-bold text-gray-900">{members.length}</span>
              </div>
              <div className="text-sm text-gray-500">Active Members</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-gray-900">{totalStories}</span>
              </div>
              <div className="text-sm text-gray-500">Total Stories</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">{totalPoints}</span>
              </div>
              <div className="text-sm text-gray-500">Total Points</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-gray-900">{avgScore.toFixed(1)}</span>
              </div>
              <div className="text-sm text-gray-500">Avg Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, team, or skill..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* View Mode */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('ranking')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'ranking'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Trophy className="w-4 h-4 inline mr-1" />
                  Ranking
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-1" />
                  All
                </button>
              </div>

              {/* Role Filter */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="developer">Developer</option>
                  <option value="lead">Lead</option>
                  <option value="tester">Tester</option>
                  <option value="designer">Designer</option>
                  <option value="pm">PM</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && !members.length ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchMembers}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No members found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-blue-600 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member, index) => (
              <MemberStatCard
                key={member.id}
                member={member}
                rank={viewMode === 'ranking' ? index + 1 : undefined}
                onClick={() => handleMemberClick(member.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
