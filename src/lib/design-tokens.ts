import type { HealthLevel } from "@/types/assessment";
import type { SurvivalStatus } from "@/types/structured-diagnosis";
import type { ToneMode } from "@/types/report-spec";

/**
 * Canonical hex values for app UI and print/PDF.
 * Keep in sync with `@theme inline` in src/app/globals.css.
 */
export const COLOR_TOKENS = {
  brand: {
    600: "#059669",
    700: "#047857",
    800: "#065f46",
  },
  surface: {
    DEFAULT: "#fafafa",
    raised: "#ffffff",
  },
  border: {
    DEFAULT: "#e4e4e7",
    subtle: "#f4f4f5",
  },
  foreground: {
    DEFAULT: "#18181b",
    muted: "#71717a",
  },
  health: {
    critical: {
      bar: "#ef4444",
      subtle: "#fee2e2",
      emphasis: "#991b1b",
      ring: "#fecaca",
    },
    weak: {
      bar: "#f97316",
      subtle: "#ffedd5",
      emphasis: "#9a3412",
      ring: "#fed7aa",
    },
    medium: {
      bar: "#f59e0b",
      subtle: "#fef3c7",
      emphasis: "#92400e",
      ring: "#fde68a",
    },
    healthy: {
      bar: "#10b981",
      subtle: "#d1fae5",
      emphasis: "#065f46",
      ring: "#a7f3d0",
    },
  },
  survival: {
    RED: { border: "#fecaca", bg: "#fef2f2" },
    AMBER: { border: "#fde68a", bg: "#fffbeb" },
    GREEN: { border: "#a7f3d0", bg: "#ecfdf5" },
  },
  tone: {
    urgent: "#991b1b",
    serious: "#92400e",
    optimization: "#065f46",
    honesty: "#3f3f46",
  },
} as const;

export const RADIUS_TOKENS = {
  card: "1rem",
  button: "9999px",
} as const;

export const SPACING_TOKENS = {
  card: "1.5rem",
  cardLg: "2rem",
} as const;

/** Tailwind utility classes backed by design tokens in globals.css */
export const HEALTH_LEVEL_BAR_CLASS: Record<HealthLevel, string> = {
  critical: "bg-health-critical",
  weak: "bg-health-weak",
  medium: "bg-health-medium",
  healthy: "bg-health-healthy",
};

export const HEALTH_LEVEL_BADGE_CLASS: Record<HealthLevel, string> = {
  critical:
    "bg-health-critical-subtle text-health-critical-emphasis ring-health-critical-ring",
  weak: "bg-health-weak-subtle text-health-weak-emphasis ring-health-weak-ring",
  medium:
    "bg-health-medium-subtle text-health-medium-emphasis ring-health-medium-ring",
  healthy:
    "bg-health-healthy-subtle text-health-healthy-emphasis ring-health-healthy-ring",
};

export const SURVIVAL_BANNER_TOKEN_CLASS: Record<SurvivalStatus, string> = {
  RED: "border-survival-red-border bg-survival-red-bg",
  AMBER: "border-survival-amber-border bg-survival-amber-bg",
  GREEN: "border-survival-green-border bg-survival-green-bg",
};

export const TONE_ACCENT_TOKEN_CLASS: Record<ToneMode, string> = {
  urgent: "text-tone-urgent",
  serious: "text-tone-serious",
  optimization: "text-tone-optimization",
  honesty: "text-tone-honesty",
};

/** CSS custom property references for print stylesheets and inline chart colors */
export function healthBarColorVar(level: HealthLevel): string {
  return `var(--color-health-${level})`;
}

export function healthBarHex(level: HealthLevel): string {
  return COLOR_TOKENS.health[level].bar;
}

export function survivalBannerHex(status: SurvivalStatus): {
  border: string;
  bg: string;
} {
  return COLOR_TOKENS.survival[status];
}

/** Flat map of token CSS variable names — useful in print.css documentation */
export const CSS_VAR_NAMES = {
  brand600: "--color-brand-600",
  brand700: "--color-brand-700",
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  border: "--color-border",
  healthCritical: "--color-health-critical",
  healthWeak: "--color-health-weak",
  healthMedium: "--color-health-medium",
  healthHealthy: "--color-health-healthy",
} as const;
