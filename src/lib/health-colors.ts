import type { HealthLevel } from "@/types/assessment";
import {
  COLOR_TOKENS,
  HEALTH_LEVEL_BADGE_CLASS,
  HEALTH_LEVEL_BAR_CLASS,
  healthBarColorVar,
  healthBarHex,
} from "@/lib/design-tokens";

export { COLOR_TOKENS, healthBarColorVar, healthBarHex };

export function healthLevelBadgeClass(level: string): string {
  return (
    HEALTH_LEVEL_BADGE_CLASS[level as HealthLevel] ??
    "bg-zinc-100 text-zinc-800 ring-zinc-200"
  );
}

export function healthLevelBarColor(level: string): string {
  return (
    HEALTH_LEVEL_BAR_CLASS[level as HealthLevel] ?? "bg-zinc-400"
  );
}
