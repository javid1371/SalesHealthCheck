import type { StageTransitionMetrics } from "@/modules/sales-funnel/sales-funnel.engine";
import { formatPercent } from "./funnel-utils";

interface FunnelTransitionLabelsProps {
  transitions: StageTransitionMetrics[];
  bottleneckTransitionIndex?: number | null;
}

export function FunnelTransitionLabels({
  transitions,
  bottleneckTransitionIndex,
}: FunnelTransitionLabelsProps) {
  if (transitions.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {transitions.map((transition) => {
        const isBottleneck =
          bottleneckTransitionIndex != null &&
          transition.fromIndex === bottleneckTransitionIndex;

        return (
          <div
            key={`${transition.fromIndex}-${transition.toIndex}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              isBottleneck
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
            }`}
          >
            <p className="font-medium">
              {transition.fromName} → {transition.toName}
            </p>
            <p className="mt-1 text-xs">
              تبدیل: {formatPercent(transition.conversionRate)}
              {" · "}
              ریزش: {formatPercent(transition.dropOffPercent)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
