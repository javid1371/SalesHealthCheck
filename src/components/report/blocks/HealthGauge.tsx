import type { HealthGaugeViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { HealthBadge } from "@/components/report/HealthBadge";
import { healthLevelBarColor } from "@/lib/health-colors";
import { resolveHealthLevel } from "@/lib/health-level";
import { SURVIVAL_LABELS } from "@/lib/report-ui";
import { cn } from "@/lib/utils";

interface HealthGaugeProps {
  gauge: HealthGaugeViewModel;
  medium?: RenderMedium;
}

export function HealthGauge({ gauge, medium = "app" }: HealthGaugeProps) {
  const level = resolveHealthLevel(gauge.percentage);

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm",
        medium === "print" && "print-avoid-break",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">{gauge.label}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900">
            {Math.round(gauge.percentage)}%
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {SURVIVAL_LABELS[gauge.survivalStatus]}
          </p>
        </div>
        <HealthBadge level={level} size="lg" />
      </div>

      <div className="mt-6">
        <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${healthLevelBarColor(level)}`}
            style={{ width: `${Math.min(100, Math.max(0, gauge.percentage))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          بر اساس سلامت وزن‌دار قیف — نه درصد کلی خام
        </p>
      </div>
    </div>
  );
}
