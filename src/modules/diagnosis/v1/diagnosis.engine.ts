import { resolveLayerStatus } from "@/lib/health-level";
import type { BottleneckResult, DiagnosisResult, LayerStatusResult } from "@/types/diagnosis";
import type { DomainScoreResult, LayerScoreResult } from "@/types/scoring";
import { diagnosticRulesV1 } from "@/config/model-v1/diagnostic-rules";
import type { DiagnosisDomainInput, DiagnosisLayerInput } from "../diagnosis.types";

export const BOTTLENECK_COUNT = 3;

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateBottlenecks(
  domainScores: DomainScoreResult[],
  domains: DiagnosisDomainInput[],
): BottleneckResult[] {
  const domainMap = new Map(domains.map((domain) => [domain.id, domain]));

  const ranked = domainScores
    .map((score) => {
      const domain = domainMap.get(score.domainId);
      if (!domain) {
        throw new Error(`Domain not found for score: ${score.domainId}`);
      }

      const weaknessScore = roundScore(100 - score.percentage);
      const priorityScore = roundScore(weaknessScore * domain.weight);

      return {
        domainId: domain.id,
        domainSlug: domain.slug,
        domainName: domain.name,
        weaknessScore,
        domainWeight: domain.weight,
        priorityScore,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.weaknessScore - a.weaknessScore;
    })
    .slice(0, BOTTLENECK_COUNT)
    .map((bottleneck, index) => ({
      ...bottleneck,
      rank: index + 1,
    }));

  return ranked;
}

export function calculateLayerStatuses(
  layerScores: LayerScoreResult[],
  layers: DiagnosisLayerInput[],
): LayerStatusResult[] {
  const layerNameMap = new Map(layers.map((layer) => [layer.id, layer.name]));

  return layerScores.map((score) => {
    const status = resolveLayerStatus(score.percentage);

    return {
      layerId: score.layerId,
      layerSlug: score.layerSlug,
      layerName: layerNameMap.get(score.layerId) ?? score.layerSlug,
      percentage: score.percentage,
      status,
    };
  });
}

function getBottleneckDiagnosis(domainSlug: string) {
  return domainSlug in diagnosticRulesV1.bottleneckDiagnoses
    ? diagnosticRulesV1.bottleneckDiagnoses[
        domainSlug as keyof typeof diagnosticRulesV1.bottleneckDiagnoses
      ]
    : undefined;
}

function getLayerDiagnosis(layerSlug: string) {
  return layerSlug in diagnosticRulesV1.layerDiagnoses
    ? diagnosticRulesV1.layerDiagnoses[
        layerSlug as keyof typeof diagnosticRulesV1.layerDiagnoses
      ]
    : undefined;
}

export function produceDiagnoses(
  bottlenecks: BottleneckResult[],
  layerStatuses: LayerStatusResult[],
): DiagnosisResult[] {
  const diagnoses: DiagnosisResult[] = [];
  let priority = 1;

  for (const bottleneck of bottlenecks) {
    const rule = getBottleneckDiagnosis(bottleneck.domainSlug);
    if (!rule) continue;

    diagnoses.push({
      diagnosisKey: rule.key,
      title: rule.title,
      description: rule.description,
      severity: rule.severity,
      priority: priority++,
      relatedDomainIds: [bottleneck.domainId],
      relatedLayerIds: [],
    });
  }

  for (const layerStatus of layerStatuses) {
    if (layerStatus.status === "healthy") continue;

    const rule = getLayerDiagnosis(layerStatus.layerSlug);
    if (!rule) continue;

    diagnoses.push({
      diagnosisKey: rule.key,
      title: rule.title,
      description: rule.description.replace("{percentage}", String(layerStatus.percentage)),
      severity: rule.severity,
      priority: priority++,
      relatedDomainIds: [],
      relatedLayerIds: [layerStatus.layerId],
    });
  }

  return diagnoses;
}

export function runDiagnosis(
  domainScores: DomainScoreResult[],
  layerScores: LayerScoreResult[],
  domains: DiagnosisDomainInput[],
  layers: DiagnosisLayerInput[],
): {
  bottlenecks: BottleneckResult[];
  layerStatuses: LayerStatusResult[];
  diagnoses: DiagnosisResult[];
} {
  const bottlenecks = calculateBottlenecks(domainScores, domains);
  const layerStatuses = calculateLayerStatuses(layerScores, layers);
  const diagnoses = produceDiagnoses(bottlenecks, layerStatuses);

  return { bottlenecks, layerStatuses, diagnoses };
}
