import type { VitalityTier } from "@/types/structured-diagnosis";

export type DomainConstants = {
  R: number;
  Q: number;
  U: number;
  kT: number;
  tier: VitalityTier;
};

/** Indexed by engine_id 1..16 */
export const DOMAIN_CONSTANTS: Record<number, DomainConstants> = {
  1: { R: 1, Q: 2, U: 3, kT: 1.3, tier: "foundation" },
  2: { R: 2, Q: 2, U: 3, kT: 1.3, tier: "foundation" },
  3: { R: 2, Q: 2, U: 3, kT: 1.3, tier: "foundation" },
  4: { R: 3, Q: 2, U: 2, kT: 1.3, tier: "foundation" },
  5: { R: 2, Q: 1, U: 1, kT: 1.6, tier: "survival" },
  6: { R: 2, Q: 2, U: 2, kT: 0.7, tier: "growth" },
  7: { R: 3, Q: 3, U: 3, kT: 1.6, tier: "survival" },
  8: { R: 2, Q: 2, U: 3, kT: 1.0, tier: "engine" },
  9: { R: 2, Q: 2, U: 1, kT: 1.0, tier: "engine" },
  10: { R: 3, Q: 2, U: 1, kT: 1.0, tier: "engine" },
  11: { R: 3, Q: 2, U: 1, kT: 1.0, tier: "engine" },
  12: { R: 3, Q: 2, U: 1, kT: 1.0, tier: "engine" },
  13: { R: 3, Q: 3, U: 1, kT: 1.6, tier: "survival" },
  14: { R: 2, Q: 2, U: 1, kT: 0.7, tier: "growth" },
  15: { R: 2, Q: 1, U: 2, kT: 0.7, tier: "growth" },
  16: { R: 1, Q: 2, U: 3, kT: 1.3, tier: "foundation" },
};

export const SURVIVAL_ENGINE_IDS = [5, 7, 13] as const;

export const W_WEIGHTS = { R: 0.45, Q: 0.3, U: 0.25 } as const;

export function calculateStructuralWeight(engineId: number): number {
  const constants = DOMAIN_CONSTANTS[engineId];
  const composite =
    W_WEIGHTS.R * constants.R +
    W_WEIGHTS.Q * constants.Q +
    W_WEIGHTS.U * constants.U;
  return constants.kT * composite;
}
