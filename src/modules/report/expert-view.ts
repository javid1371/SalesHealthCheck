import { engineIdToSlug } from "@/config/model-v1/diagnosis-engine-v2";
import type { ContentLibraryV1 } from "@/modules/report/content-library";
import type { CapacityMode, ExpertViewSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";

const HOT_VALUE_THRESHOLD = 500_000;

const SUGGESTED_OFFERS: Record<
  ExpertViewSpec["leadScore"],
  Record<CapacityMode, string>
> = {
  hot: {
    free: "تماس فوری + جلسه مشاوره ۳۰ دقیقه (گلوگاه و ارزش در خطر)",
    full: "AI + نقشه ۳۰ روزه + پشتیبانی اجرا",
  },
  warm: {
    free: "مشاوره کالیبره‌شده روی ریشه‌های ساختاری",
    full: "AI + نقشه اصلاح + پیگیری هفتگی",
  },
  cold: {
    free: "محتوای آموزشی + دعوت به ارزیابی دوره‌ای",
    full: "AI self-serve + به‌روزرسانی گزارش",
  },
};

const DISCLOSURE_GUIDES: Record<
  ExpertViewSpec["leadScore"],
  Record<CapacityMode, string>
> = {
  hot: {
    free: "ریشه و quick win را نشان بده؛ corrective کامل و tier1 عددی را پشت CTA مشاوره نگه دار.",
    full: "همه correctiveها و value-at-stake باز است؛ AI را در CTA دوم پیشنهاد بده.",
  },
  warm: {
    free: "issues و quick win باز؛ locked plan و tier2/3 کیفی را tease کن.",
    full: "گزارش کامل + AI؛ urgency CTA را ملایم‌تر از hot نگه دار.",
  },
  cold: {
    free: "تمرکز روی health gauge و دامنه‌های ضعیف؛ CTA trust-first.",
    full: "بهینه‌سازی و AI؛ از فشار urgency پرهیز کن.",
  },
};

export type ExpertViewInput = {
  diagnosis: StructuredDiagnosis;
  valueAtStake: ValueAtStakeSpec | null;
  capacityMode: CapacityMode;
  domainNames: Map<string, string>;
  contentLibrary: ContentLibraryV1;
};

function resolveDomainName(
  engineId: number,
  domainNames: Map<string, string>,
): string {
  const slug = engineIdToSlug(engineId);
  return domainNames.get(slug) ?? slug;
}

/**
 * Deterministic lead score from diagnosis signals only (layer 7).
 * Does not re-derive diagnostic roles.
 */
export function computeLeadScore(
  diagnosis: StructuredDiagnosis,
  valueAtStake: ValueAtStakeSpec | null,
): ExpertViewSpec["leadScore"] {
  if (diagnosis.survivalStatus === "RED") {
    return "hot";
  }

  if (
    valueAtStake !== null &&
    valueAtStake.tier1.monthly >= HOT_VALUE_THRESHOLD
  ) {
    return "hot";
  }

  if (diagnosis.survivalStatus === "AMBER") {
    return "warm";
  }

  if (
    diagnosis.primaryIssue !== null &&
    diagnosis.confidence !== "high"
  ) {
    return "warm";
  }

  return "cold";
}

function buildAppetizerActions(
  diagnosis: StructuredDiagnosis,
  domainNames: Map<string, string>,
  contentLibrary: ContentLibraryV1,
): ExpertViewSpec["appetizerActions"] {
  const quickWinId = diagnosis.quickWin;
  const seen = new Set<number>();

  return diagnosis.priorityLadder
    .filter((entry) => entry.engineId !== quickWinId)
    .filter((entry) => {
      if (seen.has(entry.engineId)) return false;
      seen.add(entry.engineId);
      return true;
    })
    .slice(0, 3)
    .map((entry) => {
      const domain = diagnosis.perDomain.find(
        (d) => d.engineId === entry.engineId,
      );
      const level = domain?.level ?? "weak";
      const domainSlug = entry.domainSlug;

      return {
        domainSlug,
        domainName: resolveDomainName(entry.engineId, domainNames),
        actionText: contentLibrary.resolveCorrectiveAction(domainSlug, level),
      };
    });
}

export function buildExpertView(input: ExpertViewInput): ExpertViewSpec {
  const { diagnosis, valueAtStake, capacityMode, domainNames, contentLibrary } =
    input;

  const leadScore = computeLeadScore(diagnosis, valueAtStake);

  return {
    leadScore,
    suggestedOffer: SUGGESTED_OFFERS[leadScore][capacityMode],
    appetizerActions: buildAppetizerActions(
      diagnosis,
      domainNames,
      contentLibrary,
    ),
    disclosureGuide: DISCLOSURE_GUIDES[leadScore][capacityMode],
  };
}
