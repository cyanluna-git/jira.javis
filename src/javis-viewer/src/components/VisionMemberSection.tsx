'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  X,
  Save,
  Trash2,
  RefreshCw,
  Edit2,
  User,
} from 'lucide-react';
import type {
  VisionMember,
  CreateVisionMemberInput,
  RoleCategory,
  ROLE_CATEGORY_LABELS,
  ROLE_CATEGORY_COLORS,
} from '@/types/roadmap';
import type { TeamMember } from '@/types/member';

// Re-export for use in this file
const CATEGORY_LABELS: Record<RoleCategory, string> = {
  pm: '프로젝트 관리',
  backend: '백엔드',
  frontend: '프론트엔드',
  plc: 'PLC/제어',
  qa: 'QA/테스트',
  scenario: '시나리오',
  devops: 'DevOps',
  fullstack: '풀스택',
};

const CATEGORY_COLORS: Record<RoleCategory, string> = {
  pm: '#8B5CF6',
  backend: '#3B82F6',
  frontend: '#10B981',
  plc: '#F59E0B',
  qa: '#EC4899',
  scenario: '#6366F1',
  devops: '#6B7280',
  fullstack: '#14B8A6',
};

interface VisionMemberSectionProps {
  visionId: string;
}

interface MemberResponse {
  members: VisionMember[];
  summary: {
    member_count: number;
    total_mm_allocation: number;
  };
}

export default function VisionMemberSection({ visionId }: VisionMemberSectionProps) {
  const [members, setMembers] = useState<VisionMember[]>([]);
  const [summary, setSummary] = useState({ member_count: 0, total_mm_allocation: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<VisionMember | null>(null);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateVisionMemberInput>({
    member_account_id: '',
    role_title: '',
    role_category: undefined,
    role_description: '',
    mm_allocation: undefined,
  });

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}/members`);
      if (res.ok) {
        const data: MemberResponse = await res.json();
        setMembers(data.members);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const res = await fetch('/api/members?active=true');
      if (res.ok) {
        const data = await res.json();
        setAllMembers(data);
      }
    } catch (error) {
      console.error('Error fetching all members:', error);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchAllMembers();
  }, [visionId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/roadmap/visions/${visionId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowAddModal(false);
        resetForm();
        fetchMembers();
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      const res = await fetch(
        `/api/roadmap/visions/${visionId}/members?member_account_id=${encodeURIComponent(editingMember.member_account_id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_title: formData.role_title,
            role_category: formData.role_category || null,
            role_description: formData.role_description || null,
            mm_allocation: formData.mm_allocation || null,
          }),
        }
      );

      if (res.ok) {
        setEditingMember(null);
        resetForm();
        fetchMembers();
      }
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const handleRemoveMember = async (memberAccountId: string) => {
    if (!confirm('이 멤버를 프로젝트에서 제거하시겠습니까?')) return;

    try {
      const res = await fetch(
        `/api/roadmap/visions/${visionId}/members?member_account_id=${encodeURIComponent(memberAccountId)}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        fetchMembers();
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const startEditing = (member: VisionMember) => {
    setEditingMember(member);
    setFormData({
      member_account_id: member.member_account_id,
      role_title: member.role_title,
      role_category: member.role_category as RoleCategory | undefined,
      role_description: member.role_description || '',
      mm_allocation: member.mm_allocation || undefined,
    });
  };

  const resetForm = () => {
    setFormData({
      member_account_id: '',
      role_title: '',
      role_category: undefined,
      role_description: '',
      mm_allocation: undefined,
    });
    setSearchQuery('');
  };

  // Group members by category
  const groupedMembers = members.reduce((acc, member) => {
    const category = member.role_category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(member);
    return acc;
  }, {} as Record<string, VisionMember[]>);

  // Filter available members (not already assigned)
  const assignedAccountIds = new Set(members.map(m => m.member_account_id));
  const availableMembers = allMembers.filter(
    m => !assignedAccountIds.has(m.account_id) &&
      m.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Category order for display
  const categoryOrder: (RoleCategory | 'other')[] = [
    'pm', 'fullstack', 'backend', 'frontend', 'plc', 'devops', 'qa', 'scenario', 'other'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <span className="text-sm text-gray-500">
            ({summary.member_count}명, {summary.total_mm_allocation.toFixed(1)} M/M)
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>프로젝트에 배정된 멤버가 없습니다.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 text-indigo-600 hover:text-indigo-700"
          >
            멤버 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryOrder.map(category => {
            const categoryMembers = groupedMembers[category];
            if (!categoryMembers || categoryMembers.length === 0) return null;

            const color = category !== 'other' ? CATEGORY_COLORS[category as RoleCategory] : '#9CA3AF';
            const label = category !== 'other' ? CATEGORY_LABELS[category as RoleCategory] : '기타';

            return (
              <div key={category}>
                <div
                  className="flex items-center gap-2 mb-2 px-2"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <span className="text-sm font-medium" style={{ color }}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({categoryMembers.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {categoryMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.display_name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {member.display_name}
                            </span>
                            <span className="text-sm text-gray-600">
                              {member.role_title}
                            </span>
                            {member.mm_allocation && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                {member.mm_allocation} M/M
                              </span>
                            )}
                          </div>
                          {member.role_description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                              {member.role_description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(member)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.member_account_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add Team Member</h2>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              {/* Member Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Member *
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && availableMembers.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {availableMembers.slice(0, 10).map(m => (
                      <button
                        key={m.account_id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, member_account_id: m.account_id });
                          setSearchQuery(m.display_name);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                      >
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{m.display_name}</span>
                        {m.team && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{m.team}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {formData.member_account_id && (
                  <div className="mt-1 text-xs text-green-600">
                    Selected: {searchQuery}
                  </div>
                )}
              </div>

              {/* Role Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.role_title}
                  onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  placeholder="e.g., Technical PM, Fullstack Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role Category & M/M Allocation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.role_category || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      role_category: e.target.value as RoleCategory || undefined
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select...</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    M/M Allocation
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.mm_allocation || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      mm_allocation: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    placeholder="e.g., 1.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Role Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.role_description || ''}
                  onChange={(e) => setFormData({ ...formData, role_description: e.target.value })}
                  rows={2}
                  placeholder="Describe the responsibilities..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.member_account_id || !formData.role_title}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit {editingMember.display_name}
              </h2>
              <button
                onClick={() => { setEditingMember(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateMember} className="p-6 space-y-4">
              {/* Role Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.role_title}
                  onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role Category & M/M Allocation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.role_category || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      role_category: e.target.value as RoleCategory || undefined
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select...</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    M/M Allocation
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.mm_allocation || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      mm_allocation: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Role Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.role_description || ''}
                  onChange={(e) => setFormData({ ...formData, role_description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setEditingMember(null); resetForm(); }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
