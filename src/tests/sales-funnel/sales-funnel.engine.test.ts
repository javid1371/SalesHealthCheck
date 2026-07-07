import { describe, expect, it } from "vitest";
import {
  computeSalesFunnel,
  goalSeek,
  whatIf,
  type SalesFunnelEngineInput,
} from "@/modules/sales-funnel/sales-funnel.engine";

const BASE_FUNNEL: SalesFunnelEngineInput = {
  stages: [
    { name: "سرنخ", count: 1_000 },
    { name: "واجد شرایط", count: 300 },
    { name: "پیشنهاد", count: 100 },
    { name: "مشتری", count: 30 },
  ],
  aov: 10_000,
  repeatRate: 1.2,
};

describe("computeSalesFunnel", () => {
  it("returns null for empty or invalid stages", () => {
    expect(computeSalesFunnel(null)).toBeNull();
    expect(computeSalesFunnel({ stages: [] })).toBeNull();
    expect(
      computeSalesFunnel({
        stages: [{ name: "سرنخ", count: -1 }],
      }),
    ).toBeNull();
    expect(
      computeSalesFunnel({
        stages: [{ name: "  ", count: 10 }],
      }),
    ).toBeNull();
  });

  it("computes step conversion, drop-off, and overall conversion", () => {
    const result = computeSalesFunnel(BASE_FUNNEL);

    expect(result).not.toBeNull();
    expect(result!.transitions).toHaveLength(3);
    expect(result!.transitions[0]).toMatchObject({
      fromIndex: 0,
      toIndex: 1,
      conversionRate: 0.3,
      dropOffCount: 700,
      dropOffPercent: 0.7,
    });
    expect(result!.transitions[1]).toMatchObject({
      conversionRate: 0.3333,
      dropOffCount: 200,
      dropOffPercent: 0.6667,
    });
    expect(result!.transitions[2]).toMatchObject({
      conversionRate: 0.3,
      dropOffCount: 70,
      dropOffPercent: 0.7,
    });
    expect(result!.overallConversionRate).toBe(0.03);
  });

  it("identifies the bottleneck as the highest relative drop-off", () => {
    const result = computeSalesFunnel(BASE_FUNNEL);

    expect(result!.bottleneck).toMatchObject({
      transitionIndex: 2,
      fromIndex: 2,
      toIndex: 3,
      dropOffPercent: 0.7,
    });
  });

  it("picks the later transition when drop-off percentages tie", () => {
    const result = computeSalesFunnel({
      stages: [
        { name: "A", count: 100 },
        { name: "B", count: 30 },
        { name: "C", count: 9 },
      ],
    });

    expect(result!.bottleneck).toMatchObject({
      transitionIndex: 1,
      fromIndex: 1,
      toIndex: 2,
      dropOffPercent: 0.7,
    });
  });

  it("projects revenue as customers × aov × repeatRate", () => {
    const result = computeSalesFunnel(BASE_FUNNEL);

    expect(result!.revenue).toEqual({
      customers: 30,
      aov: 10_000,
      repeatRate: 1.2,
      monthly: 360_000,
      annual: 4_320_000,
    });
  });

  it("defaults repeatRate to 1 when absent", () => {
    const result = computeSalesFunnel({
      stages: BASE_FUNNEL.stages,
      aov: 10_000,
    });

    expect(result!.revenue).toMatchObject({
      customers: 30,
      repeatRate: 1,
      monthly: 300_000,
      annual: 3_600_000,
    });
  });

  it("returns null revenue when aov is missing or invalid", () => {
    const withoutAov = computeSalesFunnel({ stages: BASE_FUNNEL.stages });
    const invalidAov = computeSalesFunnel({
      stages: BASE_FUNNEL.stages,
      aov: 0,
      repeatRate: 1,
    });

    expect(withoutAov!.revenue).toBeNull();
    expect(invalidAov!.revenue).toBeNull();
  });

  it("handles a single stage with overall conversion of 1", () => {
    const result = computeSalesFunnel({
      stages: [{ name: "مشتری", count: 42 }],
      aov: 5_000,
    });

    expect(result!.transitions).toHaveLength(0);
    expect(result!.overallConversionRate).toBe(1);
    expect(result!.bottleneck).toBeNull();
    expect(result!.revenue).toMatchObject({ customers: 42, monthly: 210_000 });
  });

  it("caps conversion at 100% when a later stage exceeds the previous count", () => {
    const result = computeSalesFunnel({
      stages: [
        { name: "A", count: 100 },
        { name: "B", count: 150 },
      ],
    });

    expect(result!.transitions[0].conversionRate).toBe(1);
    expect(result!.transitions[0].dropOffPercent).toBe(-0.5);
  });
});

describe("goalSeek", () => {
  it("back-solves required counts using current conversion rates", () => {
    const result = goalSeek(BASE_FUNNEL, 60);

    expect(result).not.toBeNull();
    expect(result!.requiredStages).toEqual([
      { name: "سرنخ", count: 2_000 },
      { name: "واجد شرایط", count: 600 },
      { name: "پیشنهاد", count: 200 },
      { name: "مشتری", count: 60 },
    ]);
    expect(result!.overallConversionRate).toBe(0.03);
  });

  it("returns null when target customers is invalid or funnel is too short", () => {
    expect(goalSeek(BASE_FUNNEL, 0)).toBeNull();
    expect(goalSeek({ stages: [{ name: "A", count: 10 }] }, 5)).toBeNull();
  });

  it("returns null when a transition has zero conversion", () => {
    const blocked = computeSalesFunnel({
      stages: [
        { name: "A", count: 100 },
        { name: "B", count: 0 },
        { name: "C", count: 0 },
      ],
    });

    expect(blocked!.transitions[0].conversionRate).toBe(0);
    expect(goalSeek({ stages: blocked!.stages }, 10)).toBeNull();
  });
});

describe("whatIf", () => {
  it("applies a conversion delta and propagates downstream counts", () => {
    const result = whatIf(BASE_FUNNEL, 0, 0.05);

    expect(result).not.toBeNull();
    expect(result!.stages).toEqual([
      { name: "سرنخ", count: 1_000 },
      { name: "واجد شرایط", count: 350 },
      { name: "پیشنهاد", count: 116.66 },
      { name: "مشتری", count: 35 },
    ]);
    expect(result!.overallConversionRate).toBe(0.035);
    expect(result!.revenue!.monthly).toBe(420_000);
  });

  it("clamps adjusted conversion between 0 and 1", () => {
    const lowered = whatIf(BASE_FUNNEL, 1, -0.5);
    const raised = whatIf(BASE_FUNNEL, 2, 0.9);

    expect(lowered!.transitions[1].conversionRate).toBe(0);
    expect(lowered!.stages[2].count).toBe(0);
    expect(raised!.transitions[2].conversionRate).toBe(1);
    expect(raised!.stages[3].count).toBe(100);
  });

  it("returns null for invalid stage index or input", () => {
    expect(whatIf(BASE_FUNNEL, -1, 0.1)).toBeNull();
    expect(whatIf(BASE_FUNNEL, 3, 0.1)).toBeNull();
    expect(whatIf({ stages: [{ name: "A", count: 1 }] }, 0, 0.1)).toBeNull();
    expect(whatIf(BASE_FUNNEL, 0, Number.NaN)).toBeNull();
  });
});
