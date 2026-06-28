import { healthLevelLabelFa } from "@/lib/health-level";
import { healthLevelBadgeClass } from "@/lib/health-colors";
import type { HealthLevel } from "@/types/assessment";

interface HealthBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function HealthBadge({ level, size = "md" }: HealthBadgeProps) {
  const label = healthLevelLabelFa(level as HealthLevel);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${healthLevelBadgeClass(level)} ${sizeClass[size]}`}
    >
      {label}
    </span>
  );
}
