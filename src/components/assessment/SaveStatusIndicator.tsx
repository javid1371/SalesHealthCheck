"use client";

import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

const STATUS_TEXT: Record<Exclude<SaveStatus, "idle">, string> = {
  saving: "در حال ذخیره…",
  saved: "ذخیره شد",
  error: "خطا در ذخیره",
};

export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <span
      className={cn(
        "text-xs",
        status === "error"
          ? "text-health-critical-emphasis"
          : "text-foreground-muted",
        status === "saved" && "animate-save-status-fade",
        className,
      )}
      aria-live="polite"
    >
      {STATUS_TEXT[status]}
    </span>
  );
}
