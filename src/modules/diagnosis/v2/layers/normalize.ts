import type { DomainLevel } from "@/types/structured-diagnosis";

export type NormalizedDomain = {
  engineId: number;
  scores: number[];
  raw: number;
  pct: number;
  gap: number;
  level: DomainLevel;
  incomplete: boolean;
};

export function resolveLevelFromRaw(raw: number): DomainLevel {
  if (raw <= 3) return "critical";
  if (raw <= 6) return "weak";
  if (raw <= 9) return "medium";
  if (raw <= 12) return "healthy";
  return "advanced";
}

export function isWeakPct(pct: number): boolean {
  return pct <= 0.4;
}

export function normalizeDomainScores(
  matrix: Record<number, number[]>,
  incompleteDomains: number[],
): Record<number, NormalizedDomain> {
  const result: Record<number, NormalizedDomain> = {};

  for (const [engineIdKey, scores] of Object.entries(matrix)) {
    const engineId = Number(engineIdKey);
    const raw = scores.reduce((sum, score) => sum + score, 0);
    const pct = raw / 15;
    const gap = (15 - raw) / 15;

    result[engineId] = {
      engineId,
      scores,
      raw,
      pct,
      gap,
      level: resolveLevelFromRaw(raw),
      incomplete: incompleteDomains.includes(engineId),
    };
  }

  return result;
}
