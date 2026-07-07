"use client";

import {
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatPersianNumber } from "@/lib/report-ui";
import type { FunnelChartStage } from "./funnel-utils";

interface SalesFunnelChartProps {
  stages: FunnelChartStage[];
  height?: number;
  showLabels?: boolean;
}

export function SalesFunnelChart({
  stages,
  height = 320,
  showLabels = true,
}: SalesFunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500"
        style={{ height }}
      >
        مرحله‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  const chartData = stages.map((stage) => ({
    name: stage.name,
    value: Math.max(stage.count, 0),
    fill: stage.fill,
    isBottleneck: stage.isBottleneck,
  }));

  return (
    <div dir="ltr" className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip
            formatter={(value) => [
              formatPersianNumber(Number(value ?? 0)),
              "تعداد",
            ]}
            labelFormatter={(label) => String(label ?? "")}
          />
          <Funnel
            dataKey="value"
            data={chartData}
            isAnimationActive
            lastShapeType="rectangle"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            {showLabels && (
              <LabelList
                position="right"
                fill="#27272a"
                stroke="none"
                dataKey="name"
              />
            )}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
