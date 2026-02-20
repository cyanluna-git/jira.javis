'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Sprint, SprintIssue } from '@/types/sprint';

interface Props {
  sprint: Sprint;
  issues: SprintIssue[];
}

interface ChartData {
  date: string;
  ideal: number;
  actual: number | null;
}

export default function BurndownChart({ sprint, issues }: Props) {
  const chartData = generateBurndownData(sprint, issues);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Burndown Chart</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No sprint dates available
        </div>
      </div>
    );
  }

  const totalPoints = chartData[0]?.ideal || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Burndown Chart</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              domain={[0, Math.ceil(totalPoints * 1.1)]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Legend />
            <Line
              type="linear"
              dataKey="ideal"
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              name="Ideal"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              name="Actual"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function generateBurndownData(sprint: Sprint, issues: SprintIssue[]): ChartData[] {
  if (!sprint.start_date || !sprint.end_date) {
    return [];
  }

  const startDate = new Date(sprint.start_date);
  const endDate = new Date(sprint.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate total story points
  let totalPoints = 0;
  issues.forEach((issue) => {
    const fields = issue.raw_data?.fields || {};
    const points = fields.customfield_10016 || fields.storyPoints || 0;
    totalPoints += points;
  });

  // If no story points, use issue count
  if (totalPoints === 0) {
    totalPoints = issues.length;
  }

  // Generate date range
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Calculate ideal burndown
  const totalDays = dates.length - 1;
  const pointsPerDay = totalPoints / totalDays;

  // Calculate done points (for actual line)
  let donePoints = 0;
  issues.forEach((issue) => {
    const status = issue.status.toLowerCase();
    if (status === 'done' || status === 'closed' || status === 'resolved') {
      const fields = issue.raw_data?.fields || {};
      const points = fields.customfield_10016 || fields.storyPoints || 0;
      donePoints += points || 1; // Use 1 if no story points
    }
  });

  const remainingPoints = totalPoints - donePoints;

  // Generate chart data
  const data: ChartData[] = dates.map((date, idx) => {
    const dateStr = formatDateShort(date);
    const idealRemaining = Math.max(0, totalPoints - pointsPerDay * idx);

    // Only show actual for dates up to today
    let actual: number | null = null;
    if (date <= today) {
      if (idx === dates.length - 1 || date.getTime() === today.getTime()) {
        // Last date or today: show current remaining
        actual = remainingPoints;
      } else if (idx === 0) {
        // First day: show total
        actual = totalPoints;
      } else {
        // For past dates, interpolate (simplified)
        const progress = idx / (dates.length - 1);
        const burned = donePoints * progress;
        actual = Math.max(0, totalPoints - burned);
      }
    }

    return {
      date: dateStr,
      ideal: Math.round(idealRemaining * 10) / 10,
      actual: actual !== null ? Math.round(actual * 10) / 10 : null,
    };
  });

  return data;
}

function formatDateShort(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
