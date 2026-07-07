"use client";

import { PrintReadyMarker } from "@/components/report/PrintReadyMarker";
import type { SalesFunnelAnalysis } from "@/modules/sales-funnel/sales-funnel.engine";
import { FunnelAnalysisPanel } from "./FunnelAnalysisPanel";
import { SalesFunnelChart } from "./SalesFunnelChart";
import { FunnelTransitionLabels } from "./FunnelTransitionLabels";
import { formatPercent, toChartStages } from "./funnel-utils";

interface FunnelChartViewProps {
  funnelName: string;
  analysis: SalesFunnelAnalysis | null;
}

export function FunnelChartView({ funnelName, analysis }: FunnelChartViewProps) {
  const chartStages = toChartStages(analysis);

  return (
    <div
      id="funnel-chart-capture"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 bg-white p-6 sm:p-8"
    >
      <PrintReadyMarker />
      <header className="text-center">
        <p className="text-sm text-zinc-500">Sales Health Check</p>
        <h1 className="mt-1 text-xl font-bold text-zinc-900">{funnelName}</h1>
        {analysis && (
          <p className="mt-2 text-sm text-zinc-600">
            نرخ تبدیل کلی: {formatPercent(analysis.overallConversionRate)}
          </p>
        )}
      </header>

      <SalesFunnelChart stages={chartStages} height={360} />

      {analysis && (
        <>
          <FunnelTransitionLabels
            transitions={analysis.transitions}
            bottleneckTransitionIndex={analysis.bottleneck?.transitionIndex}
          />
          <FunnelAnalysisPanel analysis={analysis} title="خلاصه تحلیل" />
        </>
      )}
    </div>
  );
}
