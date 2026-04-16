'use client';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface ChartData {
  label: string;
  value: number;
}

interface ResultChartProps {
  type: 'bar' | 'pie' | 'line' | 'area';
  title: string;
  data: ChartData[];
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined) return '';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { label?: string } }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label ?? payload[0]?.payload?.label ?? payload[0]?.name;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      {heading && (
        <p className="font-medium text-gray-900 dark:text-gray-100">{heading}</p>
      )}
      {payload.map((entry, index) => (
        <p
          key={`tooltip-${index}`}
          className="text-sm text-blue-600 dark:text-blue-400"
        >
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function ResultChart({ type, title, data }: ResultChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {title}
      </h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          ) : type === 'area' || type === 'line' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fill="#bfdbfe"
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
