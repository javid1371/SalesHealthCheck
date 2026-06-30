import type { QuickWinViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface QuickWinBlockProps {
  quickWin: QuickWinViewModel;
  medium?: RenderMedium;
  compact?: boolean;
}

function hasText(value?: string | null): value is string {
  return Boolean(value?.trim());
}

export function QuickWinBlock({
  quickWin,
  medium = "app",
  compact = false,
}: QuickWinBlockProps) {
  const summaryText =
    quickWin.quickWinSummary ?? quickWin.actionText ?? null;
  const hasSummary = hasText(summaryText);
  const hasFullAction = hasText(quickWin.fullAction);

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
      {hasText(quickWin.actionTitle) && (
        <p className="mt-2 text-sm font-medium text-zinc-800">
          {quickWin.actionTitle}
        </p>
      )}
      {hasSummary ? (
        <p className="mt-4 text-sm leading-8 text-zinc-700">{summaryText}</p>
      ) : (
        <p className="mt-3 text-sm leading-7 text-zinc-700">
          {quickWin.teaserSuffix}
        </p>
      )}
      {hasFullAction && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-4">
          <p className="text-xs font-medium text-emerald-800">اقدام کامل</p>
          <p className="mt-2 text-sm leading-8 text-zinc-700">
            {quickWin.fullAction}
          </p>
        </div>
      )}
      {!compact && hasSummary && (
        <p className="mt-3 text-xs text-emerald-800">
          این اقدام را می‌توانید از همین هفته شروع کنید.
        </p>
      )}
    </section>
  );
}
