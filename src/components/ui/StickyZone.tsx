import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type StickyZoneMode = "sticky" | "fixed";
type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "5xl";

interface StickyZoneProps {
  children: ReactNode;
  position: "top" | "bottom";
  variant?: "default" | "subtle";
  mode?: StickyZoneMode;
  maxWidth?: MaxWidth;
  className?: string;
  "data-assessment-progress"?: boolean;
}

const maxWidthClass: Record<MaxWidth, string> = {
  sm: "max-w-lg",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "5xl": "max-w-6xl",
};

function getPositionClass(
  position: StickyZoneProps["position"],
  mode: StickyZoneMode,
): string {
  if (position === "top") {
    if (mode === "fixed") {
      return "fixed inset-x-0 top-[var(--header-height,3.25rem)] z-20 border-b";
    }
    return "sticky top-[var(--header-height,3.25rem)] z-20 border-b";
  }
  if (mode === "fixed") {
    return "fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)]";
  }
  return "sticky bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]";
}

const variantClass: Record<NonNullable<StickyZoneProps["variant"]>, string> = {
  default: "border-border-subtle bg-surface-raised",
  subtle: "border-border-subtle/60 bg-surface/95 backdrop-blur",
};

export function StickyZone({
  children,
  position,
  variant = "default",
  mode = "sticky",
  maxWidth,
  className,
  "data-assessment-progress": dataAssessmentProgress,
}: StickyZoneProps) {
  const isFixed =
    mode === "fixed" && (position === "top" || position === "bottom");

  if (isFixed) {
    return (
      <div
        {...(dataAssessmentProgress ? { "data-assessment-progress": true } : {})}
        className={cn(
          getPositionClass(position, mode),
          variantClass[variant],
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto px-4 sm:px-6",
            maxWidth ? maxWidthClass[maxWidth] : undefined,
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      {...(dataAssessmentProgress ? { "data-assessment-progress": true } : {})}
      className={cn(
        "-mx-4 px-4 sm:-mx-6 sm:px-6",
        getPositionClass(position, mode),
        variantClass[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
