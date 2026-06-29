import { Button } from "@/components/ui/Button";
import type { CtaViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface CtaSectionProps {
  ctas: CtaViewModel[];
  medium?: RenderMedium;
  hideButtons?: boolean;
  onCtaClick?: () => void;
}

export function CtaSection({
  ctas,
  medium = "app",
  hideButtons = false,
  onCtaClick,
}: CtaSectionProps) {
  if (ctas.length === 0) return null;

  const cta = ctas[0];

  return (
    <section
      id="result-actions"
      className={cn(
        "scroll-mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <h2 className="text-lg font-semibold leading-8 text-zinc-900">
        {cta.headline}
      </h2>
      {!hideButtons && onCtaClick && (
        <Button
          className="mt-6"
          size="lg"
          onClick={() => onCtaClick()}
        >
          {cta.buttonLabel}
        </Button>
      )}
    </section>
  );
}
