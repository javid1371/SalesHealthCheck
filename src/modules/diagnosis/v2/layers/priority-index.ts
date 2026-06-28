import { DOMAIN_CONSTANTS } from "@/config/model-v1/diagnosis-engine-v2";
import { calculateStructuralWeight } from "@/config/model-v1/diagnosis-engine-v2/domain-constants";
import type { PerDomainDiagnosis } from "@/types/structured-diagnosis";
import type { NormalizedDomain } from "./normalize";

export function calculatePriorityIndex(
  normalized: Record<number, NormalizedDomain>,
  mCoefficients: Record<number, number>,
  patternMultiplier: Record<number, number>,
  constraintBonus: Record<number, number>,
  engineIdToSlug: Record<number, string>,
  displayOrderByEngineId: Record<number, number>,
): PerDomainDiagnosis[] {
  return Object.values(normalized).map((domain) => {
    const W = calculateStructuralWeight(domain.engineId);
    const M = mCoefficients[domain.engineId] ?? 1;
    const P = patternMultiplier[domain.engineId] ?? 1;
    const C = constraintBonus[domain.engineId] ?? 0;
    const PI = domain.gap * W * M * P + C;

    return {
      engineId: domain.engineId,
      domainSlug: engineIdToSlug[domain.engineId],
      displayOrder: displayOrderByEngineId[domain.engineId],
      raw: domain.raw,
      pct: domain.pct,
      gap: domain.gap,
      level: domain.level,
      W,
      M,
      PI,
      tier: DOMAIN_CONSTANTS[domain.engineId].tier,
      incomplete: domain.incomplete,
      flags: [],
    };
  });
}
