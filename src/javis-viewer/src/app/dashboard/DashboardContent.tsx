'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { CheckCircle, Clock, AlertCircle, Zap, LayoutGrid, TrendingUp, Users, Box } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  activeSprints: number;
  totalBoards: number;
  completionRate: number;
}

interface SprintVelocity {
  sprintName: string;
  sprintId: number;
  totalPoints: number;
  completedPoints: number;
  issueCount: number;
  completedCount: number;
}

interface AssigneeWorkload {
  name: string;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
}

interface StatusDistribution {
  status: string;
  count: number;
}

interface RecentIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  updated: string;
}

interface ComponentHealth {
  name: string;
  total: number;
  done: number;
  percentage: number;
}

interface Props {
  stats: DashboardStats;
  velocity: SprintVelocity[];
  workload: AssigneeWorkload[];
  statusDistribution: StatusDistribution[];
  recentIssues: RecentIssue[];
  componentHealth: ComponentHealth[];
}

const STATUS_COLORS: Record<string, string> = {
  'Done': '#22c55e',
  'Closed': '#22c55e',
  'Resolved': '#22c55e',
  'In Progress': '#3b82f6',
  'In Review': '#8b5cf6',
  'Testing': '#f59e0b',
  'To Do': '#9ca3af',
  'Open': '#9ca3af',
  'Backlog': '#6b7280',
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#9ca3af';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  } catch {
    return dateStr;
  }
}

export default function DashboardContent({
  stats,
  velocity,
  workload,
  statusDistribution,
  recentIssues,
  componentHealth,
}: Props) {
  // Prepare workload chart data
  const workloadData = workload.map(w => ({
    name: w.name.length > 10 ? w.name.slice(0, 10) + '...' : w.name,
    fullName: w.name,
    todo: w.todo,
    inProgress: w.inProgress,
    done: w.done,
  }));

  // Prepare velocity chart data
  const velocityData = velocity.map(v => ({
    name: v.sprintName.length > 15 ? v.sprintName.slice(0, 15) + '...' : v.sprintName,
    fullName: v.sprintName,
    points: v.completedPoints,
    issues: v.completedCount,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalIssues}</div>
              <div className="text-xs text-gray-500">Total Issues</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.openIssues}</div>
              <div className="text-xs text-gray-500">Open Issues</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.closedIssues}</div>
              <div className="text-xs text-gray-500">Closed Issues</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.activeSprints}</div>
              <div className="text-xs text-gray-500">Active Sprints</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <LayoutGrid className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalBoards}</div>
              <div className="text-xs text-gray-500">Boards</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.completionRate}%</div>
              <div className="text-xs text-gray-500">Completion</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocity Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Sprint Velocity
          </h3>
          {velocityData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value, name) => [value, name === 'points' ? 'Story Points' : 'Issues']}
                  />
                  <Legend formatter={(value) => value === 'points' ? 'Story Points' : 'Issues'} />
                  <Line type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  <Line type="monotone" dataKey="issues" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No sprint data available
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
          {statusDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getStatusColor(entry.status)}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} issues`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No status data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Team Workload
          </h3>
          {workloadData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workloadData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#374151' }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value, name) => {
                      const label = name === 'todo' ? 'To Do' : name === 'inProgress' ? 'In Progress' : 'Done';
                      return [value, label];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      if (value === 'todo') return 'To Do';
                      if (value === 'inProgress') return 'In Progress';
                      return 'Done';
                    }}
                  />
                  <Bar dataKey="todo" stackId="a" fill="#9ca3af" name="todo" />
                  <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="inProgress" />
                  <Bar dataKey="done" stackId="a" fill="#22c55e" name="done" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">
              No workload data available
            </div>
          )}
        </div>

        {/* Component Health */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Box className="w-5 h-5 text-orange-600" />
            Component Health
          </h3>
          {componentHealth.length > 0 ? (
            <div className="space-y-3">
              {componentHealth.map((comp) => (
                <div key={comp.name} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-700 truncate" title={comp.name}>
                    {comp.name}
                  </div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${comp.percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm text-gray-600">
                    {comp.done}/{comp.total} ({comp.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              No component data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        {recentIssues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Key</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Summary</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Assignee</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentIssues.map((issue) => (
                  <tr key={issue.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/jira?search=${issue.key}`} className="text-blue-600 hover:underline font-medium">
                        {issue.key}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{issue.summary}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: getStatusColor(issue.status) + '20',
                          color: getStatusColor(issue.status),
                        }}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{issue.assignee || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(issue.updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
