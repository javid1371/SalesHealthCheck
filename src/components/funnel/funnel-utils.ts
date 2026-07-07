import type { SalesFunnelAnalysis } from "@/modules/sales-funnel/sales-funnel.engine";

export function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
}

export function formatFunnelDate(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function buildShareChartUrl(
  funnelId: string,
  shareToken: string,
  baseUrl?: string,
): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/funnel/${funnelId}/chart?token=${encodeURIComponent(shareToken)}`;
}

export type FunnelChartStage = {
  name: string;
  count: number;
  fill: string;
  isBottleneck: boolean;
};

const STAGE_COLORS = [
  "#059669",
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#a7f3d0",
];

const BOTTLENECK_COLOR = "#ef4444";

export function toChartStages(
  analysis: SalesFunnelAnalysis | null | undefined,
): FunnelChartStage[] {
  if (!analysis) return [];

  const bottleneckIndex = analysis.bottleneck?.toIndex ?? -1;

  return analysis.stages.map((stage, index) => ({
    name: stage.name,
    count: stage.count,
    fill: index === bottleneckIndex ? BOTTLENECK_COLOR : STAGE_COLORS[index % STAGE_COLORS.length]!,
    isBottleneck: index === bottleneckIndex,
  }));
}
