import type { LockedPlanViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface LockedPlanTeaserProps {
  lockedPlan: LockedPlanViewModel;
  medium?: RenderMedium;
}

export function LockedPlanTeaser({
  lockedPlan,
  medium = "app",
}: LockedPlanTeaserProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <h2 className="text-lg font-semibold text-zinc-900">برنامه قفل‌شده</h2>
      <p className="mt-2 text-sm leading-7 text-zinc-600">{lockedPlan.body}</p>
      {lockedPlan.titles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lockedPlan.titles.map((title) => (
            <li
              key={title}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-zinc-700"
            >
              <span aria-hidden className="text-zinc-400">
                🔒
              </span>
              {title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
