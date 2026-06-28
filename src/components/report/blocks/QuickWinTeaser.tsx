import type { QuickWinTeaserViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface QuickWinTeaserProps {
  teaser: QuickWinTeaserViewModel;
  medium?: RenderMedium;
}

export function QuickWinTeaser({ teaser, medium = "app" }: QuickWinTeaserProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className="text-sm font-medium text-emerald-800">برد سریع</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">
        {teaser.domainName}
      </h2>
      <p className="mt-3 text-sm leading-7 text-zinc-700">{teaser.suffix}</p>
    </section>
  );
}
