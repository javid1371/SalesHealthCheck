import type { CapacityMode } from "@/types/report-spec";

export type CtaMoment = "urgency" | "trust";

export type CtaDestination = "consultation" | "ai-purchase";

export const ctaButtonLabels: Record<CapacityMode, string> = {
  free: "درخواست تماس",
  full: "خرید تحلیل AI + راهکارها",
};

export const ctaDestinationByCapacity: Record<CapacityMode, CtaDestination> = {
  free: "consultation",
  full: "ai-purchase",
};

export interface CtaPersonalizationInput {
  bindingConstraintDomainName?: string;
  bindingConstraintRootSentence?: string;
  structuralRootDomainNames?: string[];
}

export const ctaHeadlineTemplates = {
  urgency: {
    withBinding:
      "گلوگاه اصلی شما در {domainName} است — {rootSentence}. همین حالا قدم بعدی را بردارید.",
    default:
      "هر روز تأخیر، بخشی از فروش بالقوه را از دست می‌دهید. همین حالا اقدام کنید.",
  },
  trust: {
    withRoots:
      "ریشه‌های ساختاری در {rootNames} شناسایی شد — نقشه کامل اصلاح را با کارشناس بسازید.",
    default:
      "راهکار سریع را دیدید؛ نقشه ۳۰ روزه اختصاصی‌تان آماده است.",
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
