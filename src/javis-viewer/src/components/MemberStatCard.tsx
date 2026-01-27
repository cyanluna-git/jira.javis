'use client';

import { useState } from 'react';
import {
  User,
  Trophy,
  Target,
  Bug,
  Clock,
  TrendingUp,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { MemberWithStats, MemberRanking, MemberRole } from '@/types/member';

interface Props {
  member: MemberWithStats | MemberRanking;
  rank?: number;
  onClick?: () => void;
  showDetails?: boolean;
}

const roleColors: Record<MemberRole, string> = {
  developer: 'bg-blue-100 text-blue-700',
  lead: 'bg-purple-100 text-purple-700',
  tester: 'bg-green-100 text-green-700',
  designer: 'bg-pink-100 text-pink-700',
  pm: 'bg-orange-100 text-orange-700',
};

const maturityColors: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-gray-200 text-gray-700',
  3: 'bg-green-100 text-green-600',
  4: 'bg-green-200 text-green-700',
  5: 'bg-blue-100 text-blue-600',
  6: 'bg-blue-200 text-blue-700',
  7: 'bg-purple-100 text-purple-600',
  8: 'bg-purple-200 text-purple-700',
  9: 'bg-yellow-100 text-yellow-700',
  10: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
};

function getMaturityLabel(level: number): string {
  const labels: Record<number, string> = {
    1: 'Newcomer',
    2: 'Beginner',
    3: 'Apprentice',
    4: 'Junior',
    5: 'Intermediate',
    6: 'Advanced',
    7: 'Senior',
    8: 'Expert',
    9: 'Master',
    10: 'Legend',
  };
  return labels[level] || `Level ${level}`;
}

function getRankBadge(rank: number): { icon: React.ReactNode; color: string } | null {
  if (rank === 1) return { icon: <Trophy className="w-4 h-4" />, color: 'text-yellow-500' };
  if (rank === 2) return { icon: <Trophy className="w-4 h-4" />, color: 'text-gray-400' };
  if (rank === 3) return { icon: <Trophy className="w-4 h-4" />, color: 'text-amber-600' };
  return null;
}

export default function MemberStatCard({ member, rank, onClick, showDetails = false }: Props) {
  const [expanded, setExpanded] = useState(showDetails);

  // Handle both MemberWithStats and MemberRanking
  const isRanking = 'total_stories' in member;

  const stats = isRanking
    ? {
        stories_completed: Number(member.total_stories) || 0,
        story_points_earned: Number(member.total_points) || 0,
        bugs_fixed: Number(member.total_bugs_fixed) || 0,
        contribution_score: Number(member.contribution_score) || 0,
        maturity_level: Number(member.maturity_level) || 1,
      }
    : member.stats ? {
        stories_completed: Number(member.stats.stories_completed) || 0,
        story_points_earned: Number(member.stats.story_points_earned) || 0,
        bugs_fixed: Number(member.stats.bugs_fixed) || 0,
        contribution_score: Number(member.stats.contribution_score) || 0,
        maturity_level: Number(member.stats.maturity_level) || 1,
      } : {
        stories_completed: 0,
        story_points_earned: 0,
        bugs_fixed: 0,
        contribution_score: 50,
        maturity_level: 1,
      };

  const rankBadge = rank ? getRankBadge(rank) : null;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        {/* Rank Badge */}
        {rank && (
          <div className={`flex items-center justify-center w-8 h-8 ${rankBadge?.color || 'text-gray-500'}`}>
            {rankBadge?.icon || <span className="font-semibold text-sm">#{rank}</span>}
          </div>
        )}

        {/* Avatar */}
        <div className="flex-shrink-0">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.display_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{member.display_name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
              {member.role}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {member.team && <span>{member.team}</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${maturityColors[stats.maturity_level]}`}>
              {getMaturityLabel(stats.maturity_level)}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
            <TrendingUp className="w-4 h-4 text-green-500" />
            {stats.contribution_score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Score</div>
        </div>

        {/* Expand Toggle */}
        {!onClick && (
          <button
            className="p-1 hover:bg-gray-100 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Stats Grid (expanded) */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-gray-900">{stats.stories_completed}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Stories</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-gray-900">{stats.story_points_earned}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Points</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1">
                <Bug className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-gray-900">{stats.bugs_fixed}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Bugs Fixed</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-gray-900">Lv.{stats.maturity_level}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Maturity</div>
            </div>
          </div>

          {/* Skills */}
          {member.skills && member.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-500 mb-2">Skills</div>
              <div className="flex flex-wrap gap-1">
                {member.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
