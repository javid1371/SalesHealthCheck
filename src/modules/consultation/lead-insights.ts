import type { LeadSource, PurchaseProbability } from "@prisma/client";
import type { ExpertViewSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";

const HOT_VALUE_THRESHOLD = 500_000;

export interface PurchaseProbabilityResult {
  percent: number;
  band: PurchaseProbability;
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  direct: "درخواست مستقیم",
  system: "تشخیص سیستم",
};

export const PURCHASE_PROBABILITY_BAND_LABELS: Record<
  PurchaseProbability,
  string
> = {
  low: "پایین",
  medium: "متوسط",
  high: "بالا",
};

export function computePurchaseProbability(input: {
  leadScore: ExpertViewSpec["leadScore"];
  diagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): PurchaseProbabilityResult {
  const baseByScore: Record<ExpertViewSpec["leadScore"], number> = {
    hot: 80,
    warm: 55,
    cold: 25,
  };

  let percent = baseByScore[input.leadScore];
  const diagnosis = input.diagnosis;
  const valueAtStake = input.valueAtStake;

  if (diagnosis?.survivalStatus === "RED") {
    percent += 10;
  } else if (diagnosis?.survivalStatus === "AMBER") {
    percent += 5;
  }

  if (
    valueAtStake != null &&
    valueAtStake.tier1.monthly >= HOT_VALUE_THRESHOLD
  ) {
    percent += 10;
  }

  if (diagnosis?.confidence === "high") {
    percent += 5;
  } else if (diagnosis?.confidence === "low") {
    percent -= 5;
  }

  percent = Math.max(5, Math.min(95, Math.round(percent)));

  let band: PurchaseProbability;
  if (percent >= 70) {
    band = "high";
  } else if (percent >= 40) {
    band = "medium";
  } else {
    band = "low";
  }

  return { percent, band };
}

export function formatPurchaseProbabilityLabel(
  percent: number | null | undefined,
  band: PurchaseProbability | null | undefined,
): string | null {
  if (percent == null || band == null) {
    return null;
  }

  return `${PURCHASE_PROBABILITY_BAND_LABELS[band]} — ${percent}٪`;
}

export function isNearHotLead(leadScore: ExpertViewSpec["leadScore"]): boolean {
  return leadScore === "hot" || leadScore === "warm";
}
