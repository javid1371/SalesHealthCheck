import { Button } from "@/components/ui/Button";
import type { CtaViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface CtaSectionProps {
  ctas: CtaViewModel[];
  medium?: RenderMedium;
  hideButtons?: boolean;
  onCtaClick?: (destination: CtaViewModel["destination"]) => void;
}

export function CtaSection({
  ctas,
  medium = "app",
  hideButtons = false,
  onCtaClick,
}: CtaSectionProps) {
  if (ctas.length === 0) return null;

  return (
    <section className={cn("space-y-4", medium === "print" && "print-avoid-break")}>
      {ctas.map((cta) => (
        <div
          key={cta.moment}
          className={`rounded-2xl p-6 text-center sm:p-8 ${
            cta.moment === "urgency"
              ? "border border-red-200 bg-red-50"
              : "border border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {cta.moment === "urgency" ? "فوریت" : "اعتماد"}
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-8 text-zinc-900">
            {cta.headline}
          </h2>
          {!hideButtons && onCtaClick && (
            <Button
              className="mt-6"
              size="lg"
              onClick={() => onCtaClick(cta.destination)}
            >
              {cta.buttonLabel}
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
