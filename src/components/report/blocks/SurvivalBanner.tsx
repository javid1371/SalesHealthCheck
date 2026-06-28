import type { SurvivalBannerViewModel, RenderMedium } from "@/modules/report/report.renderer";
import {
  SURVIVAL_BANNER_CLASS,
  SURVIVAL_LABELS,
  TONE_ACCENT_CLASS,
} from "@/lib/report-ui";
import { cn } from "@/lib/utils";

interface SurvivalBannerProps {
  banner: SurvivalBannerViewModel;
  medium?: RenderMedium;
}

export function SurvivalBanner({ banner, medium = "app" }: SurvivalBannerProps) {
  return (
    <section
      className={cn(
        `rounded-2xl border p-6 shadow-sm sm:p-8 ${SURVIVAL_BANNER_CLASS[banner.status]}`,
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className={`text-sm font-medium ${TONE_ACCENT_CLASS[banner.tone]}`}>
        {SURVIVAL_LABELS[banner.status]}
      </p>
      <h2 className="mt-2 text-xl font-semibold leading-8 text-zinc-900 sm:text-2xl">
        {banner.message}
      </h2>
    </section>
  );
}
