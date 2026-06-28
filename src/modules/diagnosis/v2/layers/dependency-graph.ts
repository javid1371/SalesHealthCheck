import {
  BINARY_DEPENDENCIES,
  DEPENDENCY_EDGES,
} from "@/config/model-v1/diagnosis-engine-v2";
import type { DependencyFinding } from "@/types/structured-diagnosis";
import { isWeakPct } from "./normalize";
import type { NormalizedDomain } from "./normalize";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateBinaryM(
  normalized: Record<number, NormalizedDomain>,
  engineId: number,
): number {
  const domain = normalized[engineId];
  if (!domain || !isWeakPct(domain.pct)) return 1;

  const upstreamWeak = Object.entries(BINARY_DEPENDENCIES).some(([rootKey, symptoms]) => {
    const rootId = Number(rootKey);
    return (
      symptoms.includes(engineId) &&
      normalized[rootId] &&
      isWeakPct(normalized[rootId].pct)
    );
  });

  const downstreamWeak = (BINARY_DEPENDENCIES[engineId] ?? []).some(
    (symptomId) => normalized[symptomId] && isWeakPct(normalized[symptomId].pct),
  );

  if (downstreamWeak && !upstreamWeak) return 1.5;
  if (upstreamWeak && !downstreamWeak) return 0.5;
  return 1;
}

function calculateWeightedM(
  normalized: Record<number, NormalizedDomain>,
  engineId: number,
): number {
  const domain = normalized[engineId];
  if (!domain || !isWeakPct(domain.pct)) return 1;

  if (engineId === 16) return 1.5;

  let explained = 0;
  for (const edge of DEPENDENCY_EDGES) {
    if (edge.symptomEngineId !== engineId) continue;
    const root = normalized[edge.rootEngineId];
    if (root && isWeakPct(root.pct)) {
      explained += edge.weight * root.gap;
    }
  }

  let rootImpact = 0;
  for (const edge of DEPENDENCY_EDGES) {
    if (edge.rootEngineId !== engineId) continue;
    const symptom = normalized[edge.symptomEngineId];
    if (symptom && isWeakPct(symptom.pct)) {
      rootImpact += edge.weight * symptom.gap;
    }
  }

  const mRoot = clamp(1 + 0.5 * rootImpact, 1, 2);
  const mSymptom = clamp(1.5 - 0.6 * explained, 0.4, 1.5);

  if (rootImpact >= explained) return mRoot;
  return mSymptom;
}

export function calculateDependencyMetrics(
  normalized: Record<number, NormalizedDomain>,
  engineIdToSlug: Record<number, string>,
  useWeightedGraph = true,
): {
  mCoefficients: Record<number, number>;
  dependencyFindings: DependencyFinding[];
} {
  const mCoefficients: Record<number, number> = {};
  const dependencyFindings: DependencyFinding[] = [];

  for (const engineId of Object.keys(normalized).map(Number)) {
    if (useWeightedGraph) {
      mCoefficients[engineId] = calculateWeightedM(normalized, engineId);
      if (mCoefficients[engineId] === 1 && isWeakPct(normalized[engineId].pct)) {
        mCoefficients[engineId] = calculateBinaryM(normalized, engineId);
      }
    } else {
      mCoefficients[engineId] = calculateBinaryM(normalized, engineId);
    }
  }

  for (const edge of DEPENDENCY_EDGES) {
    const root = normalized[edge.rootEngineId];
    const symptom = normalized[edge.symptomEngineId];
    if (root && symptom && isWeakPct(root.pct) && isWeakPct(symptom.pct)) {
      dependencyFindings.push({
        rootEngineId: edge.rootEngineId,
        symptomEngineId: edge.symptomEngineId,
        rootSlug: engineIdToSlug[edge.rootEngineId],
        symptomSlug: engineIdToSlug[edge.symptomEngineId],
        weight: edge.weight,
      });
    }
  }

  return { mCoefficients, dependencyFindings };
}
