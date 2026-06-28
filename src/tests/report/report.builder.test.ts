import { describe, expect, it } from "vitest";
import { buildStructuredReport } from "@/modules/report/report.builder";
import type { BottleneckResult } from "@/types/diagnosis";
import type {
  DomainScoreResult,
  LayerScoreResult,
  OverallScoreResult,
} from "@/types/scoring";

const overallScore: OverallScoreResult = {
  rawScore: 120,
  maxScore: 240,
  percentage: 50,
  healthLevel: "weak",
};

const domainScores: DomainScoreResult[] = [
  {
    domainId: "persona-id",
    domainSlug: "persona",
    rawScore: 6,
    maxScore: 15,
    percentage: 40,
    healthLevel: "weak",
  },
  {
    domainId: "loyalty-id",
    domainSlug: "loyalty",
    rawScore: 9,
    maxScore: 15,
    percentage: 60,
    healthLevel: "medium",
  },
];

const layerScores: LayerScoreResult[] = [
  {
    layerId: "l1",
    layerSlug: "market-message-offer",
    rawScore: 6,
    maxScore: 15,
    percentage: 40,
    healthLevel: "weak",
  },
  {
    layerId: "l4",
    layerSlug: "relationship-optimization",
    rawScore: 9,
    maxScore: 15,
    percentage: 60,
    healthLevel: "medium",
  },
];

const bottlenecks: BottleneckResult[] = [
  {
    domainId: "persona-id",
    domainSlug: "persona",
    domainName: "شناخت مشتری مناسب",
    weaknessScore: 60,
    domainWeight: 1.4,
    priorityScore: 84,
    rank: 1,
  },
  {
    domainId: "loyalty-id",
    domainSlug: "loyalty",
    domainName: "وفاداری مشتری",
    weaknessScore: 40,
    domainWeight: 1.0,
    priorityScore: 40,
    rank: 2,
  },
];

describe("buildStructuredReport", () => {
  it("builds all required report sections from engine outputs", () => {
    const report = buildStructuredReport({
      overallScore,
      domainScores,
      layerScores,
      bottlenecks,
      domainNames: new Map([
        ["persona", "شناخت مشتری مناسب"],
        ["loyalty", "وفاداری مشتری"],
      ]),
      layerNames: new Map([
        ["market-message-offer", "بازار، پیام و پیشنهاد"],
        ["relationship-optimization", "رابطه، تجربه و بهینه‌سازی"],
      ]),
    });

    expect(report.overallSummary).toContain("ضعیف");
    expect(report.layerSummaries).toHaveLength(2);
    expect(report.layerSummaries[0]).toMatchObject({
      layerSlug: "market-message-offer",
      percentage: 40,
    });
    expect(report.bottleneckSummaries).toHaveLength(2);
    expect(report.bottleneckSummaries[0]).toMatchObject({
      rank: 1,
      domainSlug: "persona",
      salesImpact: expect.any(String),
    });
    expect(report.domainResults).toHaveLength(2);
    expect(report.domainResults[0].healthLevel).toBe("ضعیف");
    expect(report.domainResults[0].bandLabel).toBeTruthy();
    expect(report.correctiveActions.length).toBeGreaterThan(0);
    expect(report.actionPlans?.sevenDay.length).toBeGreaterThan(0);
    expect(report.actionPlans?.thirtyDay.length).toBeGreaterThan(0);
  });

  it("uses CSV corrective actions for top bottlenecks", () => {
    const report = buildStructuredReport({
      overallScore,
      domainScores,
      layerScores,
      bottlenecks: [bottlenecks[0]],
      domainNames: new Map([["persona", "شناخت مشتری مناسب"]]),
      layerNames: new Map([["market-message-offer", "بازار، پیام و پیشنهاد"]]),
    });

    expect(report.correctiveActions[0].domainSlug).toBe("persona");
    expect(report.correctiveActions[0].description).toContain("پرسونا");
  });

  it("builds analysisContext when answers are provided", () => {
    const report = buildStructuredReport({
      overallScore,
      domainScores,
      layerScores,
      bottlenecks: [bottlenecks[0]],
      domainNames: new Map([["persona", "شناخت مشتری مناسب"]]),
      layerNames: new Map([["market-message-offer", "بازار، پیام و پیشنهاد"]]),
      answers: [{ domainSlug: "persona", questionNumber: 1, score: 0 }],
    });

    expect(report.analysisContext?.perQuestion).toHaveLength(1);
    expect(report.analysisContext?.perQuestion[0].diagnosticIntent.length).toBeGreaterThan(
      0,
    );
    expect(report.analysisContext?.perQuestion[0].selectedInterpretation.length).toBeGreaterThan(
      0,
    );
    expect(report.analysisContext?.domainInterpretations).toHaveLength(2);
  });
});
