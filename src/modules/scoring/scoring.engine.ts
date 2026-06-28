import {
  MAX_OPTION_SCORE,
  resolveHealthLevel,
} from "@/lib/health-level";
import type {
  DomainScoreResult,
  LayerScoreResult,
  OverallScoreResult,
  SpiderChartDataPoint,
} from "@/types/scoring";
import type {
  ScoringAnswerInput,
  ScoringDomainInput,
  ScoringLayerInput,
} from "./scoring.types";

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePercentage(rawScore: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return roundPercentage((rawScore / maxScore) * 100);
}

export function calculateDomainScores(
  answers: ScoringAnswerInput[],
  domains: ScoringDomainInput[],
): DomainScoreResult[] {
  const answersByDomain = new Map<string, ScoringAnswerInput[]>();

  for (const answer of answers) {
    const existing = answersByDomain.get(answer.domainId) ?? [];
    existing.push(answer);
    answersByDomain.set(answer.domainId, existing);
  }

  return domains.map((domain) => {
    const domainAnswers = answersByDomain.get(domain.id) ?? [];
    const rawScore = domainAnswers.reduce((sum, answer) => sum + answer.score, 0);
    const maxScore = domainAnswers.length * MAX_OPTION_SCORE;
    const percentage = calculatePercentage(rawScore, maxScore);

    return {
      domainId: domain.id,
      domainSlug: domain.slug,
      rawScore,
      maxScore,
      percentage,
      healthLevel: resolveHealthLevel(percentage),
    };
  });
}

export function calculateLayerScores(
  domainScores: DomainScoreResult[],
  layers: ScoringLayerInput[],
  domains: ScoringDomainInput[],
): LayerScoreResult[] {
  const domainLayerMap = new Map(
    domains.map((domain) => [domain.id, domain.layerId]),
  );

  return layers
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((layer) => {
      const layerDomainScores = domainScores.filter(
        (score) => domainLayerMap.get(score.domainId) === layer.id,
      );

      const rawScore = layerDomainScores.reduce(
        (sum, score) => sum + score.rawScore,
        0,
      );
      const maxScore = layerDomainScores.reduce(
        (sum, score) => sum + score.maxScore,
        0,
      );
      const percentage = calculatePercentage(rawScore, maxScore);

      return {
        layerId: layer.id,
        layerSlug: layer.slug,
        rawScore,
        maxScore,
        percentage,
        healthLevel: resolveHealthLevel(percentage),
      };
    });
}

export function calculateOverallScore(
  answers: ScoringAnswerInput[],
): OverallScoreResult {
  const rawScore = answers.reduce((sum, answer) => sum + answer.score, 0);
  const maxScore = answers.length * MAX_OPTION_SCORE;
  const percentage = calculatePercentage(rawScore, maxScore);

  return {
    rawScore,
    maxScore,
    percentage,
    healthLevel: resolveHealthLevel(percentage),
  };
}

export function prepareSpiderChartData(
  domainScores: DomainScoreResult[],
  domains: ScoringDomainInput[],
): SpiderChartDataPoint[] {
  const domainNameMap = new Map(domains.map((domain) => [domain.slug, domain.name]));

  const displayOrderMap = new Map(
    domains.map((domain) => [domain.slug, domain.displayOrder]),
  );

  return domainScores
    .slice()
    .sort(
      (a, b) =>
        (displayOrderMap.get(a.domainSlug) ?? 0) -
        (displayOrderMap.get(b.domainSlug) ?? 0),
    )
    .map((score) => ({
      domainSlug: score.domainSlug,
      domainName: domainNameMap.get(score.domainSlug) ?? score.domainSlug,
      percentage: score.percentage,
    }));
}

export function averageDomainPercentages(domainScores: DomainScoreResult[]): number {
  if (domainScores.length === 0) return 0;

  const total = domainScores.reduce((sum, score) => sum + score.percentage, 0);
  return roundPercentage(total / domainScores.length);
}
