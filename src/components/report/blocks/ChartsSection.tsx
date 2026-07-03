"use client";

import { SpiderChart } from "@/components/charts/SpiderChart";
import {
  FunnelLeakChart,
  type FunnelStage,
} from "@/components/charts/FunnelLeakChart";
import {
  IssueFamilyChart,
  type IssueFamilyDatum,
} from "@/components/charts/IssueFamilyChart";
import type { ChartViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { SURVIVAL_LABELS } from "@/lib/report-ui";
import { ChartContainer } from "@/components/report/blocks/ChartContainer";
import { cn } from "@/lib/utils";

interface SurvivalChartData {
  status: string;
  alerts: Array<{
    domainSlug: string;
    domainName?: string;
    engineId: number;
    flag: string;
    pct: number;
  }>;
}

interface RadarChartData {
  domains: Array<{
    domainSlug: string;
    domainName: string;
    engineId: number;
    level: string;
    percentage: number;
  }>;
}

interface FunnelLeakChartData {
  stages: FunnelStage[];
}

interface IssueFamilyChartData {
  families: IssueFamilyDatum[];
}

interface ChartsSectionProps {
  charts: ChartViewModel[];
  medium?: RenderMedium;
}

function SurvivalChartPanel({ data }: { data: SurvivalChartData }) {
  return (
    <div className="rounded-xl border border-zinc-100 p-4">
      <p className="text-sm font-medium text-zinc-900">
        {SURVIVAL_LABELS[data.status as keyof typeof SURVIVAL_LABELS] ??
          data.status}
      </p>
      {data.alerts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.alerts.map((alert) => (
            <li
              key={`${alert.engineId}-${alert.domainSlug}`}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
            >
              <span className="text-zinc-700">
                {alert.domainName ?? alert.domainSlug}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  alert.flag === "RED"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {Math.round(alert.pct * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderChart(chart: ChartViewModel, medium: RenderMedium) {
  switch (chart.kind) {
    case "survival":
      return (
        <SurvivalChartPanel data={chart.data as SurvivalChartData} />
      );
    case "health-gauge":
      return null;
    case "radar": {
      const data = chart.data as RadarChartData;
      return (
        <div className={medium === "print" ? "mx-auto aspect-square max-h-[300px] w-full" : undefined}>
          <SpiderChart
            data={data.domains.map((d) => ({
              domainName: d.domainName,
              percentage: d.percentage,
            }))}
          />
        </div>
      );
    }
    case "funnel-leak": {
      const data = chart.data as FunnelLeakChartData;
      return <FunnelLeakChart stages={data.stages} />;
    }
    case "issue-family": {
      const data = chart.data as IssueFamilyChartData;
      return <IssueFamilyChart families={data.families} />;
    }
    default:
      return null;
  }
}

export function ChartsSection({ charts, medium = "app" }: ChartsSectionProps) {
  const visibleCharts = charts.filter((c) => c.kind !== "health-gauge");
  const isPrint = medium === "print";

  if (visibleCharts.length === 0) return null;

  const chartCaptions: Partial<Record<ChartViewModel["kind"], string>> = {
    radar: "نقشه ۱۶ دامنه — هر محور یک حوزه فروش",
    "funnel-leak": "نشت در هر مرحله قیف فروش",
    "issue-family": "توزیع مسائل بر اساس خانواده تشخیصی",
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-zinc-900">نمودارهای تشخیص</h2>
      <p className="mt-1 text-sm text-zinc-500">
        نقشه دامنه‌ها، نشت قیف و خانواده‌های مسئله
      </p>
      <div
        className={cn(
          "mx-auto mt-6 max-w-full",
          isPrint ? "max-w-none space-y-4" : "space-y-8 sm:max-w-3xl",
        )}
      >
        {visibleCharts.map((chart) => (
          <div key={chart.kind} className="overflow-x-auto">
            <ChartContainer
              title={chart.title}
              caption={chartCaptions[chart.kind]}
              medium={medium}
            >
              {renderChart(chart, medium)}
            </ChartContainer>
          </div>
        ))}
      </div>
    </section>
  );
}
