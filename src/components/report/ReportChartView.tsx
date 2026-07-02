"use client";

import { SpiderChart } from "@/components/charts/SpiderChart";
import { PrintReadyMarker } from "@/components/report/PrintReadyMarker";
import type { ReportSpec } from "@/types/report-spec";

interface RadarChartData {
  domains: Array<{
    domainSlug: string;
    domainName: string;
    engineId: number;
    level: string;
    percentage: number;
  }>;
}

interface ReportChartViewProps {
  reportSpec: ReportSpec;
  businessName?: string | null;
}

function extractRadarData(reportSpec: ReportSpec): RadarChartData["domains"] {
  const radarChart = reportSpec.charts.find((chart) => chart.kind === "radar");
  if (!radarChart) {
    return [];
  }

  const data = radarChart.data as RadarChartData;
  return data.domains ?? [];
}

export function ReportChartView({
  reportSpec,
  businessName,
}: ReportChartViewProps) {
  const domains = extractRadarData(reportSpec);

  return (
    <div
      id="report-chart-capture"
      className="mx-auto flex h-[800px] w-[800px] flex-col items-center justify-center bg-white p-8"
    >
      <PrintReadyMarker />
      <header className="mb-4 text-center">
        <p className="text-sm text-zinc-500">Sales Health Check</p>
        {businessName && (
          <h1 className="mt-1 text-xl font-bold text-zinc-900">{businessName}</h1>
        )}
        <p className="mt-2 text-sm font-medium text-zinc-700">
          نقشه ۱۶ دامنه فروش
        </p>
      </header>
      <div className="h-[640px] w-full">
        <SpiderChart
          data={domains.map((domain) => ({
            domainName: domain.domainName,
            percentage: domain.percentage,
          }))}
        />
      </div>
    </div>
  );
}
