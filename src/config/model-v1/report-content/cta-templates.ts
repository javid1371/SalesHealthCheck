import type { CapacityMode } from "@/types/report-spec";

export type CtaMoment = "urgency" | "trust";

export type CtaDestination = "consultation" | "ai-purchase";

export const ctaButtonLabels: Record<CapacityMode, string> = {
  free: "درخواست مشاوره رایگان",
  full: "درخواست مشاوره رایگان",
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
      "اولویت اصلی شما در {domainName} است — {rootSentence}. برای نقشه اقدام اختصاصی با کارشناس صحبت کنید.",
    default:
      "برای تبدیل این تحلیل به نقشه اقدام عملی، یک جلسه مشاوره رایگان رزرو کنید.",
  },
  trust: {
    withRoots:
      "ریشه‌های اصلی در {rootNames} شناسایی شد — نقشه اصلاح را با کارشناس بسازید.",
    default:
      "اولین قدم را دیدید؛ برای نقشه اقدام اختصاصی با کارشناس صحبت کنید.",
  },
} as const;

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
