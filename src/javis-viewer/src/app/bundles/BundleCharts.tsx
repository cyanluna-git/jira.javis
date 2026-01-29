'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Bundle, BundleStats } from '@/types/bundle';
import { GENERATION_COLORS } from '@/types/bundle';

interface Props {
  bundles: Bundle[];
  stats: BundleStats;
}

export default function BundleCharts({ bundles, stats }: Props) {
  const [RechartsComponents, setRechartsComponents] = useState<{
    BarChart: typeof import('recharts').BarChart;
    Bar: typeof import('recharts').Bar;
    XAxis: typeof import('recharts').XAxis;
    YAxis: typeof import('recharts').YAxis;
    Tooltip: typeof import('recharts').Tooltip;
    ResponsiveContainer: typeof import('recharts').ResponsiveContainer;
    PieChart: typeof import('recharts').PieChart;
    Pie: typeof import('recharts').Pie;
    Cell: typeof import('recharts').Cell;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    import('recharts').then(mod => {
      setRechartsComponents({
        BarChart: mod.BarChart,
        Bar: mod.Bar,
        XAxis: mod.XAxis,
        YAxis: mod.YAxis,
        Tooltip: mod.Tooltip,
        ResponsiveContainer: mod.ResponsiveContainer,
        PieChart: mod.PieChart,
        Pie: mod.Pie,
        Cell: mod.Cell,
      });
    });
  }, []);

  // Prepare data for progress bar chart (top 10 bundles by total issues)
  const progressData = useMemo(() => {
    return bundles
      .filter(b => b.progress.total > 0)
      .sort((a, b) => b.progress.total - a.progress.total)
      .slice(0, 10)
      .map(b => ({
        name: `Bundle ${b.version}`,
        done: b.progress.done,
        inProgress: b.progress.inProgress,
        todo: b.progress.todo,
        percentage: b.progress.percentage,
      }));
  }, [bundles]);

  // Prepare data for generation distribution pie chart
  const generationData = useMemo(() => {
    return [
      { name: 'Gen2/Gen2+', value: stats.byGeneration.gen2, color: GENERATION_COLORS.gen2 },
      { name: 'Gen3/Gen3+', value: stats.byGeneration.gen3, color: GENERATION_COLORS.gen3 },
    ].filter(d => d.value > 0);
  }, [stats]);

  if (progressData.length === 0 && generationData.length === 0) {
    return null;
  }

  if (!RechartsComponents || !isMounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } = RechartsComponents;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Progress Overview Chart */}
      {progressData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Progress Overview</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={progressData} layout="vertical">
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      done: 'Done',
                      inProgress: 'In Progress',
                      todo: 'To Do',
                    };
                    return [value, labels[name as string] || name];
                  }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                />
                <Bar dataKey="done" stackId="a" fill="#10B981" name="done" radius={[0, 0, 0, 0]} />
                <Bar dataKey="inProgress" stackId="a" fill="#3B82F6" name="inProgress" />
                <Bar dataKey="todo" stackId="a" fill="#9CA3AF" name="todo" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-sm text-gray-600">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-sm text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-400" />
              <span className="text-sm text-gray-600">To Do</span>
            </div>
          </div>
        </div>
      )}

      {/* Generation Distribution Chart */}
      {generationData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Generation Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={generationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                >
                  {generationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} bundles`]}
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
          <div className="mt-4 flex justify-center gap-6">
            {generationData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">{entry.name}</span>
                <span className="text-sm text-gray-400">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
