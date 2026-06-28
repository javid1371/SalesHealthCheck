import type { ReportSpec } from "@/types/report-spec";
import type { RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface QuickWinFullProps {
  quickWin: NonNullable<ReportSpec["quickWin"]>;
  medium?: RenderMedium;
}

export function QuickWinFull({ quickWin, medium = "app" }: QuickWinFullProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border-2 border-emerald-300 bg-white p-6 shadow-sm sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className="text-sm font-medium text-emerald-700">برد سریع — کامل</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-900">
        {quickWin.domainName}
      </h2>
      <p className="mt-4 text-sm leading-8 text-zinc-700">
        {quickWin.actionText}
      </p>
    </section>
  );
}
