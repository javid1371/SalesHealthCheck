import { HealthBadge } from "@/components/report/HealthBadge";
import { StickyZone } from "@/components/ui/StickyZone";

interface ResultStickySummaryProps {
  percentage: number;
  healthLevel: string;
}

export function ResultStickySummary({
  percentage,
  healthLevel,
}: ResultStickySummaryProps) {
  return (
    <StickyZone position="top" variant="subtle" className="lg:hidden">
      <div className="flex items-center justify-between gap-3 py-3">
        <div>
          <p className="text-xs font-medium text-foreground-muted">
            امتیاز کلی
          </p>
          <p className="text-xl font-bold tabular-nums text-zinc-900">
            {Math.round(percentage)}%
          </p>
        </div>
        <HealthBadge level={healthLevel} size="sm" />
      </div>
    </StickyZone>
  );
}
