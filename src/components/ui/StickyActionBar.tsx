import { type ReactNode } from "react";
import { StickyZone } from "@/components/ui/StickyZone";
import { cn } from "@/lib/utils";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  reverseOnMobile?: boolean;
  maxWidth?: MaxWidth;
}

export function StickyActionBar({
  children,
  className,
  reverseOnMobile = false,
  maxWidth = "lg",
}: StickyActionBarProps) {
  return (
    <StickyZone position="bottom" mode="fixed" maxWidth={maxWidth}>
      <div
        className={cn(
          "flex flex-col gap-3 py-4 sm:flex-row sm:justify-between",
          reverseOnMobile && "flex-col-reverse",
          className,
        )}
      >
        {children}
      </div>
    </StickyZone>
  );
}
