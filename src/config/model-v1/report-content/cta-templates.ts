import type { CapacityMode } from "@/types/report-spec";

export type CtaMoment = "urgency" | "trust";

export type CtaDestination = "consultation" | "ai-purchase";

export const ctaButtonLabels: Record<CapacityMode, string> = {
  free: "دریافت مشاوره بهبود قیف فروش",
  full: "دریافت مشاوره بهبود قیف فروش",
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
      "برای تبدیل این تحلیل به برنامه بهبود قیف فروش، مشاوره اختصاصی دریافت کنید.",
  },
  trust: {
    withRoots:
      "ریشه‌های اصلی در {rootNames} شناسایی شد — نقشه بهبود قیف فروش را با کارشناس بسازید.",
    default:
      "اولین قدم را دیدید؛ برای برنامه بهبود قیف فروش با کارشناس صحبت کنید.",
  },
} as const;

/** Fallback copy when urgency CTA is unavailable (under survival banner). */
export const ctaTopCopy = {
  headline:
    "برای بهبود وضعیت قیف فروش، مشاوره اختصاصی دریافت کنید.",
} as const;

/** Copy under health score / charts block. */
export const ctaScoreCopy = {
  headline: "می‌خواهم قیف فروشم را از این وضعیت خارج کنم",
} as const;

/** Copy after value-at-stake calculation. */
export const ctaAfterValueCopy = {
  headline:
    "برای کاهش این فروش از دست‌رفته، برنامه بهبود قیف فروشم را می‌خواهم",
} as const;

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
