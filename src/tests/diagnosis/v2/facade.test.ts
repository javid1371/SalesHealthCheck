import { describe, expect, it } from "vitest";
import { runDiagnosis } from "@/modules/diagnosis/facade";

describe("diagnosis facade v2", () => {
  it("returns structured diagnosis and legacy adapter output", () => {
    const domainScores = [
      {
        domainId: "persona-id",
        domainSlug: "persona",
        rawScore: 4,
        maxScore: 15,
        percentage: 26.67,
        healthLevel: "weak" as const,
      },
    ];

    const result = runDiagnosis({
      engineVersion: "v2",
      domainScores,
      layerScores: [],
      domains: [
        {
          id: "persona-id",
          slug: "persona",
          name: "شناخت مشتری",
          weight: 1.4,
          displayOrder: 1,
        },
      ],
      layers: [],
      answers: Array.from({ length: 5 }, (_, index) => ({
        displayOrder: 1,
        domainSlug: "persona",
        questionNumber: index + 1,
        score: index === 0 ? 0 : 1,
      })),
    });

    expect(result.engineVersion).toBe("v2");
    expect(result.structuredDiagnosis?.engineVersion).toBe("v2");
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.diagnoses.length).toBeGreaterThan(0);
  });
});
