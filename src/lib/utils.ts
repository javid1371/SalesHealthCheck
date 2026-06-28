export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function percentage(raw: number, max: number): number {
  if (max === 0) return 0;
  return (raw / max) * 100;
}

export function healthLevelFromPercentage(
  percentage: number,
): "critical" | "weak" | "medium" | "healthy" {
  if (percentage <= 25) return "critical";
  if (percentage <= 50) return "weak";
  if (percentage <= 75) return "medium";
  return "healthy";
}
