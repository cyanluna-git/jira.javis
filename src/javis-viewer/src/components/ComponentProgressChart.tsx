'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issues: SprintIssue[];
  selectedComponents?: Set<string>;
  onComponentClick?: (componentName: string) => void;
}

interface ComponentStatus {
  name: string;
  fullName: string;
  todo: number;
  inProgress: number;
  done: number;
  total: number;
  donePercent: number;
}

function getStatusCategory(status: string): 'todo' | 'inProgress' | 'done' {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'closed' || s === 'resolved') {
    return 'done';
  }
  if (s === 'in progress' || s === 'in review' || s === 'testing') {
    return 'inProgress';
  }
  return 'todo';
}

export default function ComponentProgressChart({ issues, selectedComponents, onComponentClick }: Props) {
  const chartData = useMemo<ComponentStatus[]>(() => {
    const componentMap = new Map<string, { todo: number; inProgress: number; done: number }>();

    issues.forEach((issue) => {
      const components = issue.raw_data?.fields?.components || [];
      const statusCategory = getStatusCategory(issue.status);

      const componentNames = components.length > 0
        ? components.map((c: any) => c.name || 'Unknown')
        : ['No Component'];

      componentNames.forEach((name: string) => {
        if (!componentMap.has(name)) {
          componentMap.set(name, { todo: 0, inProgress: 0, done: 0 });
        }
        const stats = componentMap.get(name)!;
        stats[statusCategory]++;
      });
    });

    return Array.from(componentMap.entries())
      .map(([name, stats]) => {
        const total = stats.todo + stats.inProgress + stats.done;
        return {
          name: name.length > 15 ? name.slice(0, 15) + '...' : name,
          fullName: name,
          ...stats,
          total,
          donePercent: total > 0 ? Math.round((stats.done / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // 최대 8개까지만 표시
  }, [issues]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Component Progress</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No component data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Component Progress</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: '#374151' }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
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
            <Bar dataKey="todo" stackId="a" fill="#9ca3af" name="todo" radius={[0, 0, 0, 0]} />
            <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="inProgress" radius={[0, 0, 0, 0]} />
            <Bar dataKey="done" stackId="a" fill="#22c55e" name="done" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Progress Summary */}
      <div className="mt-4 space-y-2">
        {chartData.map((comp) => {
          const isSelected = !selectedComponents || selectedComponents.size === 0 || selectedComponents.has(comp.fullName);
          return (
            <button
              key={comp.name}
              onClick={() => onComponentClick?.(comp.fullName)}
              className={`flex items-center gap-3 w-full text-left p-1 rounded transition-all ${
                onComponentClick ? 'hover:bg-gray-50 cursor-pointer' : ''
              } ${isSelected ? '' : 'opacity-40'}`}
            >
              <div className="w-24 text-sm text-gray-700 truncate" title={comp.fullName}>
                {comp.name}
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${comp.donePercent}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm font-medium text-gray-600">
                {comp.donePercent}%
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
