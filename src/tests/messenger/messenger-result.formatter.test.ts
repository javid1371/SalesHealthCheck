import { describe, expect, it } from "vitest";
import { formatAssessmentResultForMessenger } from "@/modules/messenger/messenger-result.formatter";
import { MESSENGER_MESSAGE_MAX_LENGTH } from "@/modules/messenger/bot/send-long-text";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";

function buildSampleResult(): AssessmentResultResponse {
  return {
    assessmentId: "assessment-1",
    status: "completed",
    overallScore: {
      rawScore: 40,
      maxScore: 240,
      percentage: 16.7,
      healthLevel: "critical",
    },
    domainScores: [
      {
        domainId: "d1",
        name: "Persona",
        percentage: 20,
        healthLevel: "critical",
        layer: "Foundation",
      },
    ],
    layerScores: [
      {
        layerId: "l1",
        name: "Foundation",
        percentage: 25,
        healthLevel: "weak",
      },
    ],
    bottlenecks: [
      {
        rank: 1,
        domainId: "d1",
        domainName: "Persona",
        weaknessScore: 0.8,
        domainWeight: 1,
        priorityScore: 0.8,
      },
    ],
    diagnoses: [
      {
        diagnosisKey: "weak-persona",
        title: "ضعف در Persona",
        severity: "high",
        priority: 1,
      },
    ],
    report: {
      id: "report-1",
      reportStatus: "generated",
      overallSummary: "خلاصه کلی گزارش.",
      layerSummaries: [],
      bottleneckSummaries: [
        {
          rank: 1,
          domainSlug: "persona",
          domainName: "Persona",
          summary: "مشتری هدف تعریف نشده است.",
          salesImpact: "CAC بالا",
        },
      ],
      correctiveActions: [
        {
          domainSlug: "persona",
          domainName: "Persona",
          description: "پرسونای مشتری را مستند کنید.",
        },
      ],
      diagnosisSummary: {
        survivalStatus: "RED",
        healthWeighted: 16,
        healthFlat: 16,
        primaryIssue: {
          engineId: 1,
          domainSlug: "persona",
          domainName: "Persona",
        },
        structuralRoots: [],
        quickWin: null,
        bindingConstraint: null,
        confidence: "medium",
        instrumentFirst: false,
        issueRootQuestions: [],
      },
    },
    spiderChartData: [
      {
        domainSlug: "persona",
        domainName: "Persona",
        percentage: 20,
      },
    ],
  };
}

describe("formatAssessmentResultForMessenger", () => {
  it("includes survival banner, score, and summary sections", () => {
    const parts = formatAssessmentResultForMessenger(buildSampleResult());
    const combined = parts.join("\n");

    expect(parts.length).toBeGreaterThan(0);
    expect(combined).toContain("گزارش ارزیابی");
    expect(combined).toContain("خلاصه کلی گزارش");
    expect(combined).toContain("گلوگاه");
    expect(combined).toContain("اقدامات اصلاحی");
    expect(combined).toContain("امتیاز لایه");
  });

  it("keeps each message under messenger limit", () => {
    const parts = formatAssessmentResultForMessenger(buildSampleResult());

    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MESSENGER_MESSAGE_MAX_LENGTH);
    }
  });
});
