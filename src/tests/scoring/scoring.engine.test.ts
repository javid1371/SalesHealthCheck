import { describe, expect, it } from "vitest";
import {
  averageDomainPercentages,
  calculateDomainScores,
  calculateLayerScores,
  calculateOverallScore,
  prepareSpiderChartData,
} from "@/modules/scoring/scoring.engine";
import type {
  ScoringAnswerInput,
  ScoringDomainInput,
  ScoringLayerInput,
} from "@/modules/scoring/scoring.types";

const domains: ScoringDomainInput[] = [
  {
    id: "d1",
    slug: "domain-a",
    name: "Domain A",
    layerId: "l1",
    layerSlug: "layer-1",
    displayOrder: 1,
  },
  {
    id: "d2",
    slug: "domain-b",
    name: "Domain B",
    layerId: "l1",
    layerSlug: "layer-1",
    displayOrder: 2,
  },
  {
    id: "d3",
    slug: "domain-c",
    name: "Domain C",
    layerId: "l2",
    layerSlug: "layer-2",
    displayOrder: 3,
  },
];

const layers: ScoringLayerInput[] = [
  { id: "l1", slug: "layer-1", name: "Layer 1", displayOrder: 1 },
  { id: "l2", slug: "layer-2", name: "Layer 2", displayOrder: 2 },
];

function makeAnswers(
  entries: Array<{ domainId: string; domainSlug: string; scores: number[] }>,
): ScoringAnswerInput[] {
  return entries.flatMap(({ domainId, domainSlug, scores }) =>
    scores.map((score, index) => ({
      questionId: `${domainId}-q${index + 1}`,
      domainId,
      domainSlug,
      score,
    })),
  );
}

describe("calculateDomainScores", () => {
  it("calculates raw, max, and percentage per domain", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [3, 2, 1] },
      { domainId: "d2", domainSlug: "domain-b", scores: [0, 0] },
    ]);

    const result = calculateDomainScores(answers, domains.slice(0, 2));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      domainId: "d1",
      rawScore: 6,
      maxScore: 9,
      percentage: 66.67,
      healthLevel: "medium",
    });
    expect(result[1]).toMatchObject({
      domainId: "d2",
      rawScore: 0,
      maxScore: 6,
      percentage: 0,
      healthLevel: "critical",
    });
  });

  it("returns zero scores for domains with no answers", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [3] },
    ]);

    const result = calculateDomainScores(answers, domains);

    expect(result.find((score) => score.domainId === "d3")).toMatchObject({
      rawScore: 0,
      maxScore: 0,
      percentage: 0,
      healthLevel: "critical",
    });
  });
});

describe("calculateOverallScore", () => {
  it("is not the average of domain percentages when question counts differ", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [3, 3] },
      { domainId: "d2", domainSlug: "domain-b", scores: [0, 0, 0, 0] },
    ]);

    const domainScores = calculateDomainScores(answers, domains.slice(0, 2));
    const overall = calculateOverallScore(answers);
    const domainAverage = averageDomainPercentages(domainScores);

    expect(domainAverage).toBe(50);
    expect(overall.rawScore).toBe(6);
    expect(overall.maxScore).toBe(18);
    expect(overall.percentage).toBe(33.33);
    expect(overall.percentage).not.toBe(domainAverage);
  });

  it("returns critical health when all answers are zero", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [0, 0, 0] },
      { domainId: "d2", domainSlug: "domain-b", scores: [0, 0] },
    ]);

    const overall = calculateOverallScore(answers);

    expect(overall).toMatchObject({
      rawScore: 0,
      maxScore: 15,
      percentage: 0,
      healthLevel: "critical",
    });
  });

  it("returns healthy when all answers are three", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [3, 3] },
      { domainId: "d2", domainSlug: "domain-b", scores: [3, 3, 3] },
    ]);

    const overall = calculateOverallScore(answers);

    expect(overall).toMatchObject({
      rawScore: 15,
      maxScore: 15,
      percentage: 100,
      healthLevel: "healthy",
    });
  });
});

describe("calculateLayerScores", () => {
  it("aggregates domain scores within each layer", () => {
    const answers = makeAnswers([
      { domainId: "d1", domainSlug: "domain-a", scores: [3, 3] },
      { domainId: "d2", domainSlug: "domain-b", scores: [1, 1] },
      { domainId: "d3", domainSlug: "domain-c", scores: [0, 0, 0] },
    ]);

    const domainScores = calculateDomainScores(answers, domains);
    const layerScores = calculateLayerScores(domainScores, layers, domains);

    expect(layerScores).toHaveLength(2);
    expect(layerScores[0]).toMatchObject({
      layerId: "l1",
      rawScore: 8,
      maxScore: 12,
      percentage: 66.67,
      healthLevel: "medium",
    });
    expect(layerScores[1]).toMatchObject({
      layerId: "l2",
      rawScore: 0,
      maxScore: 9,
      percentage: 0,
      healthLevel: "critical",
    });
  });
});

describe("prepareSpiderChartData", () => {
  it("returns chart points sorted by domain display order", () => {
    const answers = makeAnswers([
      { domainId: "d3", domainSlug: "domain-c", scores: [3] },
      { domainId: "d1", domainSlug: "domain-a", scores: [1] },
      { domainId: "d2", domainSlug: "domain-b", scores: [2] },
    ]);

    const domainScores = calculateDomainScores(answers, domains);
    const chartData = prepareSpiderChartData(domainScores, domains);

    expect(chartData.map((point) => point.domainSlug)).toEqual([
      "domain-a",
      "domain-b",
      "domain-c",
    ]);
    expect(chartData[0]).toMatchObject({
      domainName: "Domain A",
      percentage: 33.33,
    });
  });
});
