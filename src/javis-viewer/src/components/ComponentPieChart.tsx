'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issues: SprintIssue[];
  selectedComponents?: Set<string>;
  onComponentClick?: (componentName: string) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

interface ChartData {
  name: string;
  value: number;
  percentage: string;
}

export default function ComponentPieChart({ issues, selectedComponents, onComponentClick }: Props) {
  const chartData = useMemo<ChartData[]>(() => {
    const componentMap = new Map<string, number>();

    issues.forEach((issue) => {
      const components = issue.raw_data?.fields?.components || [];
      if (components.length === 0) {
        componentMap.set('No Component', (componentMap.get('No Component') || 0) + 1);
      } else {
        components.forEach((comp: any) => {
          const name = comp.name || 'Unknown';
          componentMap.set(name, (componentMap.get(name) || 0) + 1);
        });
      }
    });

    const total = issues.length;
    return Array.from(componentMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: `${Math.round((value / total) * 100)}%`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [issues]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Components</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No component data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Components Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
              onClick={(data) => onComponentClick?.(data.name)}
              style={{ cursor: onComponentClick ? 'pointer' : 'default' }}
            >
              {chartData.map((entry, index) => {
                const isSelected = !selectedComponents || selectedComponents.size === 0 || selectedComponents.has(entry.name);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    opacity={isSelected ? 1 : 0.3}
                  />
                );
              })}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} issues`, name]}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {chartData.map((entry, index) => {
          const isSelected = !selectedComponents || selectedComponents.size === 0 || selectedComponents.has(entry.name);
          return (
            <button
              key={entry.name}
              onClick={() => onComponentClick?.(entry.name)}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-all ${
                onComponentClick ? 'hover:bg-gray-100 cursor-pointer' : ''
              } ${isSelected ? '' : 'opacity-40'}`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-700">{entry.name}</span>
              <span className="text-gray-400">({entry.value})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
