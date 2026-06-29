import type { QuickWinViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface QuickWinBlockProps {
  quickWin: QuickWinViewModel;
  medium?: RenderMedium;
  compact?: boolean;
}

export function QuickWinBlock({
  quickWin,
  medium = "app",
  compact = false,
}: QuickWinBlockProps) {
  const hasAction = Boolean(quickWin.actionText);

  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className="text-sm font-medium text-emerald-800">اولین قدم پیشنهادی</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900 sm:text-xl">
        {quickWin.domainName}
      </h2>
      {hasAction ? (
        <p className="mt-4 text-sm leading-8 text-zinc-700">
          {quickWin.actionText}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-7 text-zinc-700">
          {quickWin.teaserSuffix}
        </p>
      )}
      {!compact && hasAction && (
        <p className="mt-3 text-xs text-emerald-800">
          این اقدام را می‌توانید از همین هفته شروع کنید.
        </p>
      )}
    </section>
  );
}
