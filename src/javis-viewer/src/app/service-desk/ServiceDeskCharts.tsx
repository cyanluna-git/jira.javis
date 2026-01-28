'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/types/service-desk';

interface ChartData {
  byStatus: { status: string; count: number }[];
  byComponent: { component: string; count: number }[];
}

interface Props {
  data: ChartData;
}

export default function ServiceDeskCharts({ data }: Props) {
  const { byStatus, byComponent } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Status Pie Chart */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Status Distribution</h3>
        <div className="h-64">
          {byStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {byStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Component Bar Chart */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Tickets by Component</h3>
        <div className="h-64">
          {byComponent.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byComponent.slice(0, 8)}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <XAxis type="number" />
                <YAxis type="category" dataKey="component" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
