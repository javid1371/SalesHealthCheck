import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeInput, ValueAtStakeSpec } from "@/types/value-at-stake";

/** Conservative target health (healthy band). */
const H_TARGET_CONSERVATIVE = 0.7;
/** Optimistic target health (advanced band). */
const H_TARGET_OPTIMISTIC = 0.9;
/** Critical-level floor when lever health is zero (avoids divide-by-zero). */
const CRITICAL_HEALTH_FLOOR = 0.2;
/** Maximum conversion rate (physical boundary). */
const MAX_CONVERSION_RATE = 1;

const CONVERSION_ENGINE_IDS = [7, 8, 9, 10, 11, 12, 13] as const;
const AOV_ENGINE_ID = 4;
const REPEAT_ENGINE_IDS = [6, 14] as const;
const ACQUISITION_ENGINE_IDS = [2, 3, 5] as const;

const TIER2_QUALITATIVE_HEALTHY =
  "با قیفِ سالم، ظرفیتِ جذبِ سرنخِ بیشتر و با کیفیت‌تر باز می‌شود — این لایه در v1 فقط جهت‌دار است، نه عددی.";
const TIER2_QUALITATIVE_WEAK =
  "پس از بهبودِ نرخ تبدیل و AOV، سرنخِ بیشتری می‌تواند به فروش تبدیل شود — عددِ این لایه عمداً کیفی نگه داشته شده است.";

const TIER3_MECHANISM =
  "وقتی نرخ تبدیل و میانگین خرید بالا می‌روند، سودِ هر سرنخ از هزینه‌ی هر سرنخ بیشتر می‌شود؛ از این نقطه جذبِ پولی سودده می‌شود و رشد مرکب (scale) واقعی شکل می‌گیرد.";
const TIER3_CONDITIONS = [
  "اندازه و ظرفیت بازار",
  "سرعت و کیفیتِ اجرا",
  "زمانِ لازم برای بهبودِ اهرم‌ها",
];

type LeverHealth = {
  conversion: number;
  aov: number;
  repeat: number;
  acquisition: number;
};

type Tier1Breakdown = {
  monthly: number;
  breakdown: ValueAtStakeSpec["tier1"]["breakdown"];
};

function isValidMetric(value: number | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function pctForEngine(
  perDomain: StructuredDiagnosis["perDomain"],
  engineId: number,
): number {
  const domain = perDomain.find((entry) => entry.engineId === engineId);
  return domain?.pct ?? 0;
}

function averagePct(
  engineIds: readonly number[],
  perDomain: StructuredDiagnosis["perDomain"],
): number {
  if (engineIds.length === 0) return 0;
  const sum = engineIds.reduce(
    (total, engineId) => total + pctForEngine(perDomain, engineId),
    0,
  );
  return sum / engineIds.length;
}

function safeLeverHealth(health: number): number {
  return health > 0 ? health : CRITICAL_HEALTH_FLOOR;
}

function potentialMultiplier(health: number, target: number): number {
  return target / safeLeverHealth(health);
}

function extractLeverHealth(
  perDomain: StructuredDiagnosis["perDomain"],
): LeverHealth {
  return {
    conversion: averagePct(CONVERSION_ENGINE_IDS, perDomain),
    aov: pctForEngine(perDomain, AOV_ENGINE_ID),
    repeat: averagePct(REPEAT_ENGINE_IDS, perDomain),
    acquisition: averagePct(ACQUISITION_ENGINE_IDS, perDomain),
  };
}

function computeTier1Breakdown(
  metrics: {
    R0: number;
    AOV: number;
    L: number;
    F0: number;
    CR0: number;
    customers0: number;
  },
  health: LeverHealth,
  target: number,
): Tier1Breakdown {
  const convMultiplier = potentialMultiplier(health.conversion, target);
  const aovMultiplier = potentialMultiplier(health.aov, target);
  const repeatMultiplier = potentialMultiplier(health.repeat, target);

  const CR_potential = Math.min(metrics.CR0 * convMultiplier, MAX_CONVERSION_RATE);
  const AOV_potential = metrics.AOV * aovMultiplier;
  const F_potential = metrics.F0 * repeatMultiplier;

  const conversionGain = Math.max(
    0,
    metrics.L * (CR_potential - metrics.CR0) * metrics.AOV * metrics.F0,
  );
  const aovGain = Math.max(
    0,
    metrics.customers0 * metrics.F0 * (AOV_potential - metrics.AOV),
  );
  const repeatGain = Math.max(
    0,
    metrics.customers0 * metrics.AOV * (F_potential - metrics.F0),
  );

  const breakdown = {
    conversion: roundMoney(conversionGain),
    aov: roundMoney(aovGain),
    repeat: roundMoney(repeatGain),
  };

  return {
    monthly: roundMoney(conversionGain + aovGain + repeatGain),
    breakdown,
  };
}

function widenRangeForConfidence(
  low: number,
  high: number,
  confidence: StructuredDiagnosis["confidence"],
): { low: number; high: number } {
  if (confidence !== "low") {
    return { low: roundMoney(low), high: roundMoney(high) };
  }

  return {
    low: roundMoney(low * 0.85),
    high: roundMoney(high * 1.15),
  };
}

function buildTier2Qualitative(health: LeverHealth): string {
  const acquisitionHealthy = health.acquisition >= H_TARGET_CONSERVATIVE;
  const conversionHealthy = health.conversion >= H_TARGET_CONSERVATIVE;

  if (acquisitionHealthy && conversionHealthy) {
    return TIER2_QUALITATIVE_HEALTHY;
  }

  return TIER2_QUALITATIVE_WEAK;
}

function validateInput(input: ValueAtStakeInput | null | undefined): ValueAtStakeInput | null {
  if (!input) return null;
  if (!isValidMetric(input.R0) || !isValidMetric(input.AOV) || !isValidMetric(input.L)) {
    return null;
  }
  if (input.RP !== undefined && !isValidMetric(input.RP)) {
    return null;
  }
  return input;
}

/**
 * Pure Value-at-Stake engine (M1).
 * Consumes StructuredDiagnosis + four business numbers; returns null on incomplete input.
 */
export function computeValueAtStake(
  diagnosis: StructuredDiagnosis,
  input: ValueAtStakeInput | null | undefined,
): ValueAtStakeSpec | null {
  const validated = validateInput(input);
  if (!validated) return null;

  const { R0, AOV, L, RP } = validated;
  const F0 = RP ?? 1;

  const transactions = R0 / AOV;
  const customers = transactions / F0;
  const CR0 = Math.min(customers / L, MAX_CONVERSION_RATE);
  const customers0 = L * CR0;

  const baseMetrics = { R0, AOV, L, F0, CR0, customers0 };
  const health = extractLeverHealth(diagnosis.perDomain);

  const conservative = computeTier1Breakdown(
    baseMetrics,
    health,
    H_TARGET_CONSERVATIVE,
  );
  const optimistic = computeTier1Breakdown(
    baseMetrics,
    health,
    H_TARGET_OPTIMISTIC,
  );

  const range = widenRangeForConfidence(
    conservative.monthly,
    optimistic.monthly,
    diagnosis.confidence,
  );

  return {
    tier1: {
      monthly: conservative.monthly,
      annual: roundMoney(conservative.monthly * 12),
      range,
      breakdown: conservative.breakdown,
    },
    tier2: { qualitative: buildTier2Qualitative(health) },
    tier3: {
      mechanism: TIER3_MECHANISM,
      conditions: [...TIER3_CONDITIONS],
    },
    confidence: diagnosis.confidence,
  };
}
