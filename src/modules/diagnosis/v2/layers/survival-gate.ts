import {
  DOMAIN_CONSTANTS,
  SURVIVAL_ENGINE_IDS,
} from "@/config/model-v1/diagnosis-engine-v2";
import type { SurvivalStatus } from "@/types/structured-diagnosis";
import type { NormalizedDomain } from "./normalize";

export type SurvivalResult = {
  survivalStatus: SurvivalStatus;
  survivalAlerts: Array<{
    engineId: number;
    domainSlug: string;
    flag: "RED" | "AMBER";
    pct: number;
  }>;
  domainFlags: Record<number, "RED" | "AMBER" | "GREEN">;
};

function survivalFlagForPct(pct: number): "RED" | "AMBER" | "GREEN" {
  if (pct <= 0.2) return "RED";
  if (pct <= 0.4) return "AMBER";
  return "GREEN";
}

export function evaluateSurvivalGate(
  normalized: Record<number, NormalizedDomain>,
  engineIdToSlug: Record<number, string>,
): SurvivalResult {
  const domainFlags: Record<number, "RED" | "AMBER" | "GREEN"> = {};
  const survivalAlerts: SurvivalResult["survivalAlerts"] = [];

  for (const engineId of SURVIVAL_ENGINE_IDS) {
    const domain = normalized[engineId];
    if (!domain || domain.incomplete) continue;

    const flag = survivalFlagForPct(domain.pct);
    domainFlags[engineId] = flag;

    if (flag === "RED" || flag === "AMBER") {
      survivalAlerts.push({
        engineId,
        domainSlug: engineIdToSlug[engineId],
        flag,
        pct: domain.pct,
      });
    }
  }

  const hasRed = survivalAlerts.some((alert) => alert.flag === "RED");
  const hasAmber = survivalAlerts.some((alert) => alert.flag === "AMBER");

  let survivalStatus: SurvivalStatus = "GREEN";
  if (hasRed) survivalStatus = "RED";
  else if (hasAmber) survivalStatus = "AMBER";

  return { survivalStatus, survivalAlerts, domainFlags };
}

export function calculateHealthMetrics(
  normalized: Record<number, NormalizedDomain>,
): { healthFlat: number; healthWeighted: number } {
  const domains = Object.values(normalized).filter((domain) => !domain.incomplete);
  const totalRaw = domains.reduce((sum, domain) => sum + domain.raw, 0);
  const healthFlat = totalRaw / 240;

  const weightedNumerator = domains.reduce(
    (sum, domain) => sum + domain.pct * DOMAIN_CONSTANTS[domain.engineId].R,
    0,
  );
  const weightedDenominator = domains.reduce(
    (sum, domain) => sum + DOMAIN_CONSTANTS[domain.engineId].R,
    0,
  );

  const healthWeighted =
    weightedDenominator === 0 ? 0 : weightedNumerator / weightedDenominator;

  return { healthFlat, healthWeighted };
}
