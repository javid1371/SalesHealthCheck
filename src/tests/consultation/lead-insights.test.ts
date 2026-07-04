import { describe, expect, it } from "vitest";
import {
  computePurchaseProbability,
  formatPurchaseProbabilityLabel,
  isNearHotLead,
  LEAD_SOURCE_LABELS,
} from "@/modules/consultation/lead-insights";

describe("computePurchaseProbability", () => {
  it("maps hot lead score to high band with RED survival boost", () => {
    const result = computePurchaseProbability({
      leadScore: "hot",
      diagnosis: {
        survivalStatus: "RED",
        confidence: "high",
      } as never,
      valueAtStake: {
        tier1: { monthly: 600_000 },
      } as never,
    });

    expect(result.percent).toBeGreaterThanOrEqual(70);
    expect(result.band).toBe("high");
  });

  it("maps warm lead score to medium band", () => {
    const result = computePurchaseProbability({
      leadScore: "warm",
      diagnosis: {
        survivalStatus: "AMBER",
        confidence: "medium",
      } as never,
    });

    expect(result.percent).toBeGreaterThanOrEqual(40);
    expect(result.percent).toBeLessThan(70);
    expect(result.band).toBe("medium");
  });

  it("maps cold lead score to low band and clamps to minimum 5", () => {
    const result = computePurchaseProbability({
      leadScore: "cold",
      diagnosis: {
        survivalStatus: "GREEN",
        confidence: "low",
      } as never,
    });

    expect(result.percent).toBeGreaterThanOrEqual(5);
    expect(result.percent).toBeLessThan(40);
    expect(result.band).toBe("low");
  });

  it("clamps percent to maximum 95", () => {
    const result = computePurchaseProbability({
      leadScore: "hot",
      diagnosis: {
        survivalStatus: "RED",
        confidence: "high",
      } as never,
      valueAtStake: {
        tier1: { monthly: 2_000_000 },
      } as never,
    });

    expect(result.percent).toBeLessThanOrEqual(95);
  });
});

describe("formatPurchaseProbabilityLabel", () => {
  it("formats percent and band in Persian", () => {
    expect(formatPurchaseProbabilityLabel(78, "high")).toBe("بالا — 78٪");
  });

  it("returns null when data is missing", () => {
    expect(formatPurchaseProbabilityLabel(null, "high")).toBeNull();
  });
});

describe("isNearHotLead", () => {
  it("treats hot and warm as near-hot", () => {
    expect(isNearHotLead("hot")).toBe(true);
    expect(isNearHotLead("warm")).toBe(true);
    expect(isNearHotLead("cold")).toBe(false);
  });
});

describe("LEAD_SOURCE_LABELS", () => {
  it("maps source enums to Persian labels", () => {
    expect(LEAD_SOURCE_LABELS.direct).toBe("درخواست مستقیم");
    expect(LEAD_SOURCE_LABELS.system).toBe("تشخیص سیستم");
  });
});
