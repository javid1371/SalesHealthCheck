"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface SpiderChartProps {
  data: Array<{
    domainName: string;
    percentage: number;
  }>;
}

function truncateLabel(label: string, max = 14): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max)}…`;
}

export function SpiderChart({ data }: SpiderChartProps) {
  const chartData = data.map((item) => ({
    domain: truncateLabel(item.domainName),
    fullName: item.domainName,
    value: item.percentage,
  }));

  return (
    <div dir="ltr" className="mx-auto h-72 w-full max-w-lg sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: "#52525b", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "امتیاز"]}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload as
                | { fullName?: string }
                | undefined;
              return item?.fullName ?? "";
            }}
          />
          <Radar
            name="امتیاز"
            dataKey="value"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.35}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
