import { describe, expect, it } from "vitest";
import {
  BOTTLENECK_COUNT,
  calculateBottlenecks,
  calculateLayerStatuses,
  produceDiagnoses,
} from "@/modules/diagnosis/diagnosis.engine";
import type { DomainScoreResult, LayerScoreResult } from "@/types/scoring";

const domains = [
  { id: "persona-id", slug: "persona", name: "شناخت مشتری", weight: 1.4 },
  { id: "loyalty-id", slug: "loyalty", name: "وفاداری", weight: 1.0 },
  { id: "closing-id", slug: "closing", name: "نهایی‌سازی", weight: 1.2 },
  { id: "uvp-id", slug: "uvp", name: "ارزش پیشنهادی", weight: 1.4 },
];

const layers = [
  { id: "l1", slug: "market-message-offer", name: "بازار و پیام" },
  { id: "l4", slug: "relationship-optimization", name: "رابطه و بهینه‌سازی" },
];

function domainScore(
  domainId: string,
  domainSlug: string,
  percentage: number,
): DomainScoreResult {
  const rawScore = percentage;
  const maxScore = 100;

  return {
    domainId,
    domainSlug,
    rawScore,
    maxScore,
    percentage,
    healthLevel:
      percentage <= 25
        ? "critical"
        : percentage <= 50
          ? "weak"
          : percentage <= 75
            ? "medium"
            : "healthy",
  };
}

function layerScore(
  layerId: string,
  layerSlug: string,
  percentage: number,
): LayerScoreResult {
  return {
    layerId,
    layerSlug,
    rawScore: percentage,
    maxScore: 100,
    percentage,
    healthLevel:
      percentage <= 25
        ? "critical"
        : percentage <= 50
          ? "weak"
          : percentage <= 75
            ? "medium"
            : "healthy",
  };
}

describe("calculateBottlenecks", () => {
  it("ranks high-weight persona above lower-weight domain with worse percentage", () => {
    const domainScores = [
      domainScore("persona-id", "persona", 50),
      domainScore("loyalty-id", "loyalty", 35),
    ];

    const bottlenecks = calculateBottlenecks(
      domainScores,
      domains.slice(0, 2),
    );

    expect(bottlenecks[0].domainSlug).toBe("persona");
    expect(bottlenecks[0].weaknessScore).toBe(50);
    expect(bottlenecks[0].priorityScore).toBe(70);
    expect(bottlenecks[1].domainSlug).toBe("loyalty");
    expect(bottlenecks[1].priorityScore).toBe(65);
  });

  it("returns exactly three bottlenecks with sequential ranks", () => {
    const domainScores = domains.map((domain, index) =>
      domainScore(domain.id, domain.slug, 10 + index * 5),
    );

    const bottlenecks = calculateBottlenecks(domainScores, domains);

    expect(bottlenecks).toHaveLength(3);
    expect(bottlenecks.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(bottlenecks[0].priorityScore).toBeGreaterThanOrEqual(
      bottlenecks[1].priorityScore,
    );
    expect(bottlenecks[1].priorityScore).toBeGreaterThanOrEqual(
      bottlenecks[2].priorityScore,
    );
  });

  it("uses weakness score as tiebreaker when priority scores match", () => {
    const equalWeightDomains = [
      { id: "a", slug: "persona", name: "A", weight: 1.0 },
      { id: "b", slug: "uvp", name: "B", weight: 1.0 },
    ];
    const domainScores = [
      domainScore("a", "persona", 30),
      domainScore("b", "uvp", 20),
    ];

    const bottlenecks = calculateBottlenecks(domainScores, equalWeightDomains);

    expect(bottlenecks[0].domainSlug).toBe("uvp");
    expect(bottlenecks[0].weaknessScore).toBe(80);
  });
});

describe("calculateLayerStatuses", () => {
  it("maps layer percentages to status labels", () => {
    const layerScores = [
      layerScore("l1", "market-message-offer", 80),
      layerScore("l4", "relationship-optimization", 40),
    ];

    const statuses = calculateLayerStatuses(layerScores, layers);

    expect(statuses).toEqual([
      expect.objectContaining({
        layerSlug: "market-message-offer",
        status: "healthy",
        percentage: 80,
      }),
      expect.objectContaining({
        layerSlug: "relationship-optimization",
        status: "weak",
        percentage: 40,
      }),
    ]);
  });
});

describe("produceDiagnoses", () => {
  it("creates diagnoses for bottlenecks and weak layers", () => {
    const bottlenecks = calculateBottlenecks(
      [
        domainScore("persona-id", "persona", 20),
        domainScore("loyalty-id", "loyalty", 15),
        domainScore("closing-id", "closing", 25),
      ],
      domains,
    );
    const layerStatuses = calculateLayerStatuses(
      [layerScore("l1", "market-message-offer", 35)],
      layers,
    );

    const diagnoses = produceDiagnoses(bottlenecks, layerStatuses);

    expect(diagnoses.length).toBeGreaterThan(0);
    expect(diagnoses.some((item) => item.diagnosisKey === "weak-persona")).toBe(
      true,
    );
    expect(
      diagnoses.some((item) => item.diagnosisKey === "layer-weak-market-message-offer"),
    ).toBe(true);
  });
});
