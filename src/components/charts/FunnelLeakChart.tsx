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
import { domainLevelBarColor } from "@/lib/report-ui";

export interface FunnelStage {
  domainSlug: string;
  domainName: string;
  engineId: number;
  level: string;
  percentage: number;
}

interface FunnelLeakChartProps {
  stages: FunnelStage[];
}

function truncateLabel(label: string, max = 12): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max)}…`;
}

export function FunnelLeakChart({ stages }: FunnelLeakChartProps) {
  const chartData = stages.map((stage) => ({
    ...stage,
    shortName: truncateLabel(stage.domainName),
  }));

  return (
    <div dir="ltr" className="mx-auto h-64 w-full max-w-lg sm:h-80 sm:max-w-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#71717a" }} />
          <YAxis
            type="category"
            dataKey="shortName"
            width={88}
            tick={{ fontSize: 10, fill: "#52525b" }}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "امتیاز"]}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload as FunnelStage | undefined;
              return item?.domainName ?? "";
            }}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((entry) => (
              <Cell key={entry.domainSlug} fill={barColorHex(entry.level)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function barColorHex(level: string): string {
  const map: Record<string, string> = {
    critical: "#ef4444",
    weak: "#f97316",
    medium: "#f59e0b",
    healthy: "#10b981",
    advanced: "#059669",
  };
  return map[level] ?? "#a1a1aa";
}

export { domainLevelBarColor };
