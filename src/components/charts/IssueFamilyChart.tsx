"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface IssueFamilyDatum {
  key: string;
  label: string;
  averagePct: number;
  engineIds: number[];
}

interface IssueFamilyChartProps {
  families: IssueFamilyDatum[];
}

const FAMILY_COLORS = [
  "#059669",
  "#0d9488",
  "#0891b2",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
];

export function IssueFamilyChart({ families }: IssueFamilyChartProps) {
  const chartData = families.map((family) => ({
    name: family.label,
    value: family.averagePct,
    key: family.key,
  }));

  return (
    <div dir="ltr" className="mx-auto h-56 w-full max-w-lg sm:h-64 sm:max-w-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#52525b" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={56}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#71717a" }} />
          <Tooltip formatter={(value) => [`${value}%`, "میانگین"]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.key}
                fill={FAMILY_COLORS[index % FAMILY_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
