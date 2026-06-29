import { valueStakeTeaserBody } from "@/config/model-v1/report-content/tone-templates";
import type { RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface ValueStakeTeaserProps {
  medium?: RenderMedium;
}

export function ValueStakeTeaser({ medium = "app" }: ValueStakeTeaserProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4",
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className="text-sm leading-7 text-zinc-600">{valueStakeTeaserBody}</p>
    </section>
  );
}
