'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { GitCompare, TrendingUp, TrendingDown, Minus, Users, Box } from 'lucide-react';

interface Sprint {
  id: number;
  name: string;
  state: string;
  boardName: string;
}

interface SprintStats {
  sprintId: number;
  sprintName: string;
  totalIssues: number;
  completedIssues: number;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
  pointCompletionRate: number;
}

interface AssigneeStats {
  name: string;
  sprint1Issues: number;
  sprint1Points: number;
  sprint2Issues: number;
  sprint2Points: number;
}

interface ComponentStats {
  name: string;
  sprint1Total: number;
  sprint1Done: number;
  sprint2Total: number;
  sprint2Done: number;
}

interface Props {
  sprints: Sprint[];
  selectedSprint1: number | null;
  selectedSprint2: number | null;
  sprint1Stats: SprintStats | null;
  sprint2Stats: SprintStats | null;
  assigneeComparison: AssigneeStats[];
  componentComparison: ComponentStats[];
}

function DiffIndicator({ value1, value2, suffix = '' }: { value1: number; value2: number; suffix?: string }) {
  const diff = value2 - value1;
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <TrendingUp className="w-4 h-4" />
        +{diff}{suffix}
      </span>
    );
  } else if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <TrendingDown className="w-4 h-4" />
        {diff}{suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
      <Minus className="w-4 h-4" />
      0{suffix}
    </span>
  );
}

export default function CompareContent({
  sprints,
  selectedSprint1,
  selectedSprint2,
  sprint1Stats,
  sprint2Stats,
  assigneeComparison,
  componentComparison,
}: Props) {
  const router = useRouter();

  const handleSprintChange = (which: 'sprint1' | 'sprint2', value: string) => {
    const params = new URLSearchParams();
    if (which === 'sprint1') {
      if (value) params.set('sprint1', value);
      if (selectedSprint2) params.set('sprint2', String(selectedSprint2));
    } else {
      if (selectedSprint1) params.set('sprint1', String(selectedSprint1));
      if (value) params.set('sprint2', value);
    }
    router.push(`/sprints/compare?${params.toString()}`);
  };

  // Prepare comparison bar chart data
  const comparisonData = sprint1Stats && sprint2Stats ? [
    {
      metric: 'Total Issues',
      [sprint1Stats.sprintName]: sprint1Stats.totalIssues,
      [sprint2Stats.sprintName]: sprint2Stats.totalIssues,
    },
    {
      metric: 'Completed',
      [sprint1Stats.sprintName]: sprint1Stats.completedIssues,
      [sprint2Stats.sprintName]: sprint2Stats.completedIssues,
    },
    {
      metric: 'Total Points',
      [sprint1Stats.sprintName]: sprint1Stats.totalPoints,
      [sprint2Stats.sprintName]: sprint2Stats.totalPoints,
    },
    {
      metric: 'Completed Points',
      [sprint1Stats.sprintName]: sprint1Stats.completedPoints,
      [sprint2Stats.sprintName]: sprint2Stats.completedPoints,
    },
  ] : [];

  // Prepare radar chart data for completion rates
  // Normalize velocity relative to max points between both sprints
  const maxPoints = sprint1Stats && sprint2Stats
    ? Math.max(sprint1Stats.completedPoints, sprint2Stats.completedPoints) || 1
    : 1;
  const radarData = sprint1Stats && sprint2Stats ? [
    { metric: 'Issue Completion', sprint1: sprint1Stats.completionRate, sprint2: sprint2Stats.completionRate },
    { metric: 'Point Completion', sprint1: sprint1Stats.pointCompletionRate, sprint2: sprint2Stats.pointCompletionRate },
    { metric: 'Velocity', sprint1: Math.round((sprint1Stats.completedPoints / maxPoints) * 100), sprint2: Math.round((sprint2Stats.completedPoints / maxPoints) * 100) },
  ] : [];

  // Prepare assignee comparison data
  const assigneeData = assigneeComparison.map(a => ({
    name: a.name.length > 8 ? a.name.slice(0, 8) + '...' : a.name,
    fullName: a.name,
    sprint1: a.sprint1Points,
    sprint2: a.sprint2Points,
  }));

  // Prepare component comparison data
  const componentData = componentComparison.map(c => ({
    name: c.name.length > 10 ? c.name.slice(0, 10) + '...' : c.name,
    fullName: c.name,
    sprint1Rate: c.sprint1Total > 0 ? Math.round((c.sprint1Done / c.sprint1Total) * 100) : 0,
    sprint2Rate: c.sprint2Total > 0 ? Math.round((c.sprint2Done / c.sprint2Total) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Sprint Selectors */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-6 h-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-800">Select Sprints to Compare</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sprint 1 (Baseline)</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
              value={selectedSprint1 || ''}
              onChange={(e) => handleSprintChange('sprint1', e.target.value)}
            >
              <option value="">Select Sprint...</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id} disabled={s.id === selectedSprint2}>
                  {s.name} ({s.boardName}) - {s.state}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sprint 2 (Compare)</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
              value={selectedSprint2 || ''}
              onChange={(e) => handleSprintChange('sprint2', e.target.value)}
            >
              <option value="">Select Sprint...</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id} disabled={s.id === selectedSprint1}>
                  {s.name} ({s.boardName}) - {s.state}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* No Selection Message */}
      {(!selectedSprint1 || !selectedSprint2) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GitCompare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select two sprints to compare their performance</p>
        </div>
      )}

      {/* Comparison Results */}
      {sprint1Stats && sprint2Stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Issue Completion</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{sprint2Stats.completionRate}%</span>
                <DiffIndicator value1={sprint1Stats.completionRate} value2={sprint2Stats.completionRate} suffix="%" />
              </div>
              <div className="text-xs text-gray-400 mt-1">vs {sprint1Stats.completionRate}%</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Point Completion</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{sprint2Stats.pointCompletionRate}%</span>
                <DiffIndicator value1={sprint1Stats.pointCompletionRate} value2={sprint2Stats.pointCompletionRate} suffix="%" />
              </div>
              <div className="text-xs text-gray-400 mt-1">vs {sprint1Stats.pointCompletionRate}%</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Completed Issues</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{sprint2Stats.completedIssues}</span>
                <DiffIndicator value1={sprint1Stats.completedIssues} value2={sprint2Stats.completedIssues} />
              </div>
              <div className="text-xs text-gray-400 mt-1">vs {sprint1Stats.completedIssues}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Completed Points</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{sprint2Stats.completedPoints}</span>
                <DiffIndicator value1={sprint1Stats.completedPoints} value2={sprint2Stats.completedPoints} />
              </div>
              <div className="text-xs text-gray-400 mt-1">vs {sprint1Stats.completedPoints}</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Metrics Comparison */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Metrics Comparison</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="metric" tick={{ fontSize: 12, fill: '#374151' }} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey={sprint1Stats.sprintName} fill="#9ca3af" radius={[0, 4, 4, 0]} />
                    <Bar dataKey={sprint2Stats.sprintName} fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Radar</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#374151' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar
                      name={sprint1Stats.sprintName}
                      dataKey="sprint1"
                      stroke="#9ca3af"
                      fill="#9ca3af"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name={sprint2Stats.sprintName}
                      dataKey="sprint2"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Assignee Comparison */}
          {assigneeData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Completed Points by Assignee
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assigneeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                      formatter={(value, name) => [value, name === 'sprint1' ? sprint1Stats.sprintName : sprint2Stats.sprintName]}
                    />
                    <Legend formatter={(value) => value === 'sprint1' ? sprint1Stats.sprintName : sprint2Stats.sprintName} />
                    <Bar dataKey="sprint1" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sprint2" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Component Comparison */}
          {componentData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 text-orange-600" />
                Component Completion Rate Comparison
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                      formatter={(value, name) => [
                        `${value}%`,
                        name === 'sprint1Rate' ? sprint1Stats.sprintName : sprint2Stats.sprintName
                      ]}
                    />
                    <Legend formatter={(value) => value === 'sprint1Rate' ? sprint1Stats.sprintName : sprint2Stats.sprintName} />
                    <Bar dataKey="sprint1Rate" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sprint2Rate" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
