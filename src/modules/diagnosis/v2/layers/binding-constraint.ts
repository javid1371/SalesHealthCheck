import { BINDING_FLOW_ORDER } from "@/config/model-v1/diagnosis-engine-v2";
import type { NormalizedDomain } from "./normalize";

export function findBindingConstraint(
  normalized: Record<number, NormalizedDomain>,
): number | null {
  for (const engineId of BINDING_FLOW_ORDER) {
    const domain = normalized[engineId];
    if (domain && !domain.incomplete && domain.raw <= 6) {
      return engineId;
    }
  }
  return null;
}

export function calculateConstraintBonus(
  normalized: Record<number, NormalizedDomain>,
  bindingConstraint: number | null,
): Record<number, number> {
  const bonuses: Record<number, number> = {};

  if (bindingConstraint === null) return bonuses;

  const domain = normalized[bindingConstraint];
  if (!domain) return bonuses;

  bonuses[bindingConstraint] = 0.5 * domain.gap;
  return bonuses;
}
