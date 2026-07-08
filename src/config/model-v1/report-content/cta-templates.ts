import { formatToman } from "@/lib/report-ui";
import type { CapacityMode } from "@/types/report-spec";

export type CtaMoment = "urgency" | "trust";

export type CtaDestination = "consultation" | "ai-purchase";

export const ctaButtonLabels: Record<CapacityMode, string> = {
  free: "ثبت درخواست تماس رایگان",
  full: "ثبت درخواست تماس رایگان",
};

export const ctaDestinationByCapacity: Record<CapacityMode, CtaDestination> = {
  free: "consultation",
  full: "consultation",
};

export interface CtaPersonalizationInput {
  bindingConstraintDomainName?: string;
  bindingConstraintRootSentence?: string;
  structuralRootDomainNames?: string[];
}

export const ctaHeadlineTemplates = {
  urgency: {
    withBinding:
      "اولویت اصلی شما در {domainName} است — {rootSentence}. برای بهبود قیف فروش، برنامه اختصاصی دریافت کنید.",
    default:
      "این تحلیل را به برنامه عملی تبدیل کنید — یک تماس کوتاه و کاملاً رایگان با کارشناس، بدون هیچ تعهدی.",
  },
  trust: {
    withRoots:
      "ریشه‌های اصلی در {rootNames} شناسایی شد — نقشه بهبود قیف فروش را با کارشناس بسازید.",
    default:
      "اولین قدم را دیدید؛ در یک تماس کوتاه و رایگان، مسیر بهبود قیف فروش را با کارشناس ترسیم کنید.",
  },
} as const;

/** Fallback copy when urgency CTA is unavailable (under survival banner). */
export const ctaTopCopy = {
  headline:
    "می‌خواهید قیف فروشتان را بهبود دهید؟ یک تماس کوتاه و کاملاً رایگان با کارشناس — بدون تعهد.",
} as const;

/** Copy under health score / charts block. */
export const ctaScoreCopy = {
  headline:
    "از این وضعیت خارج شوید — یک تماس کوتاه و رایگان برای نقشه اقدام اختصاصی.",
} as const;

/** Copy after value-at-stake calculation (fallback when monthly amount unavailable). */
export const ctaAfterValueCopy = {
  headline:
    "برای کاهش این فروش از دست‌رفته، در یک تماس کوتاه و رایگان مسیر جبران را بگیرید.",
} as const;

export function ctaAfterValueHeadline(monthlyToman: number): string {
  return `حدود ${formatToman(monthlyToman)} در ماه فرصت فروش از دست می‌رود — در یک تماس کوتاه و رایگان، مسیر جبرانش را بگیرید`;
}

/** Compact CTA inside locked domain fix sections. */
export const ctaDomainFixLabel = "دریافت راهکار بهبود قیف فروش";

export function getCtaDestination(capacityMode: CapacityMode): CtaDestination {
  return ctaDestinationByCapacity[capacityMode];
}

export function getCtaButtonLabel(capacityMode: CapacityMode): string {
  return ctaButtonLabels[capacityMode];
}

export function buildCtaHeadline(
  moment: CtaMoment,
  personalization: CtaPersonalizationInput,
): string {
  if (moment === "urgency") {
    const { bindingConstraintDomainName, bindingConstraintRootSentence } =
      personalization;

    if (bindingConstraintDomainName && bindingConstraintRootSentence) {
      return ctaHeadlineTemplates.urgency.withBinding
        .replace("{domainName}", bindingConstraintDomainName)
        .replace("{rootSentence}", bindingConstraintRootSentence);
    }

    return ctaHeadlineTemplates.urgency.default;
  }

  const rootNames = personalization.structuralRootDomainNames?.filter(Boolean);

  if (rootNames && rootNames.length > 0) {
    return ctaHeadlineTemplates.trust.withRoots.replace(
      "{rootNames}",
      rootNames.join("، "),
    );
  }

  return ctaHeadlineTemplates.trust.default;
}
