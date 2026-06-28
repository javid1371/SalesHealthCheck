import type { HealthLevel } from "@/types/assessment";

export const MAX_OPTION_SCORE = 3;

export function resolveHealthLevel(percentage: number): HealthLevel {
  if (percentage <= 25) return "critical";
  if (percentage <= 50) return "weak";
  if (percentage <= 75) return "medium";
  return "healthy";
}

export function resolveLayerStatus(
  percentage: number,
): "healthy" | "medium" | "weak" | "critical" {
  return resolveHealthLevel(percentage);
}

export function healthLevelLabelFa(level: HealthLevel): string {
  const labels: Record<HealthLevel, string> = {
    critical: "بحرانی",
    weak: "ضعیف",
    medium: "متوسط",
    healthy: "سالم",
  };
  return labels[level];
}

export function layerStatusLabelFa(
  status: "healthy" | "medium" | "weak" | "critical",
): string {
  const labels = {
    critical: "بحرانی",
    weak: "ضعیف",
    medium: "قابل بهبود",
    healthy: "سالم",
  } as const;
  return labels[status];
}
