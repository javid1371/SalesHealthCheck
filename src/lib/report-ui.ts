import type { DomainLevel } from "@/types/structured-diagnosis";
import type { SurvivalStatus } from "@/types/structured-diagnosis";
import type { ToneMode } from "@/types/report-spec";
import type { ReportIssue } from "@/types/report-spec";
import {
  COLOR_TOKENS,
  CSS_VAR_NAMES,
  SURVIVAL_BANNER_TOKEN_CLASS,
  TONE_ACCENT_TOKEN_CLASS,
  healthBarHex,
} from "@/lib/design-tokens";
import { healthLevelBarColor } from "@/lib/health-colors";

export {
  COLOR_TOKENS,
  CSS_VAR_NAMES,
  healthBarHex,
  survivalBannerHex,
} from "@/lib/design-tokens";

export const SURVIVAL_LABELS: Record<SurvivalStatus, string> = {
  RED: "بحرانی — قیف در خطر",
  AMBER: "هشدار — بقای قیف شکننده",
  GREEN: "بقای قیف پایدار",
};

export const SURVIVAL_BANNER_CLASS = SURVIVAL_BANNER_TOKEN_CLASS;

export const TONE_ACCENT_CLASS = TONE_ACCENT_TOKEN_CLASS;

/** Hex pairs for survival banners — use in print CSS or chart legends */
export const SURVIVAL_BANNER_COLORS: Record<
  SurvivalStatus,
  { border: string; bg: string }
> = COLOR_TOKENS.survival;

export const ISSUE_ROLE_LABELS: Record<ReportIssue["role"], string> = {
  primary_issue: "مشکل اصلی",
  structural_root: "ریشه ساختاری",
  binding_constraint: "گلوگاه جریان",
};

export const DOMAIN_LEVEL_LABELS: Record<DomainLevel, string> = {
  critical: "بحرانی",
  weak: "ضعیف",
  medium: "متوسط",
  healthy: "سالم",
  advanced: "پیشرفته",
};

export function domainLevelBarColor(level: string): string {
  if (level === "critical") return healthLevelBarColor("critical");
  if (level === "weak") return healthLevelBarColor("weak");
  if (level === "medium") return healthLevelBarColor("medium");
  if (level === "healthy" || level === "advanced") {
    return healthLevelBarColor("healthy");
  }
  return healthLevelBarColor("medium");
}

/** Hex bar color for a domain level — for Recharts and print inline styles */
export function domainLevelBarHex(level: string): string {
  if (level === "critical") return healthBarHex("critical");
  if (level === "weak") return healthBarHex("weak");
  if (level === "medium") return healthBarHex("medium");
  if (level === "healthy" || level === "advanced") {
    return healthBarHex("healthy");
  }
  return healthBarHex("medium");
}

export function formatPersianNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

export function formatToman(value: number): string {
  return `${formatPersianNumber(value)} تومان`;
}

export const LEAD_SCORE_LABELS = {
  hot: "داغ",
  warm: "گرم",
  cold: "سرد",
} as const;
