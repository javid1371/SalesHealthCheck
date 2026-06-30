import { Button } from "@/components/ui/Button";
import type { RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

export type CtaSectionVariant = "inline" | "prominent";

interface CtaSectionProps {
  headline: string;
  buttonLabel: string;
  variant?: CtaSectionVariant;
  medium?: RenderMedium;
  hideButtons?: boolean;
  onCtaClick?: () => void;
  sectionId?: string;
}

export function CtaSection({
  headline,
  buttonLabel,
  variant = "prominent",
  medium = "app",
  hideButtons = false,
  onCtaClick,
  sectionId,
}: CtaSectionProps) {
  const isInline = variant === "inline";

  return (
    <section
      id={sectionId}
      className={cn(
        "scroll-mt-8 text-center",
        isInline
          ? "rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 sm:px-6 sm:py-5"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <h2
        className={cn(
          "font-semibold text-zinc-900",
          isInline
            ? "text-sm leading-7 sm:text-base"
            : "text-lg leading-8",
        )}
      >
        {headline}
      </h2>
      {!hideButtons && onCtaClick && (
        <Button
          className={cn(isInline ? "mt-4" : "mt-6")}
          size={isInline ? "md" : "lg"}
          onClick={() => onCtaClick()}
        >
          {buttonLabel}
        </Button>
      )}
    </section>
  );
}
