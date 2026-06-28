import { describe, expect, it } from "vitest";
import { ENGINE_IDS } from "@/config/model-v1/diagnosis-engine-v2";
import { computeValueAtStake } from "@/modules/report/value-at-stake.engine";
import { runDiagnosisV2FromRawScores } from "@/modules/diagnosis/v2/run-diagnosis-v2";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeInput } from "@/types/value-at-stake";

function buildUniformDiagnosis(pct: number): StructuredDiagnosis {
  const rawByEngineId: Record<number, number> = {};
  for (const engineId of ENGINE_IDS) {
    rawByEngineId[engineId] = Math.round(pct * 15);
  }

  return runDiagnosisV2FromRawScores({ rawByEngineId });
}

const BASE_METRICS: ValueAtStakeInput = {
  R0: 1_000_000,
  AOV: 10_000,
  L: 1_000,
};

describe("computeValueAtStake", () => {
  it("returns null when the four-number gate is skipped or incomplete", () => {
    const diagnosis = buildUniformDiagnosis(0.3);

    expect(computeValueAtStake(diagnosis, null)).toBeNull();
    expect(computeValueAtStake(diagnosis, undefined)).toBeNull();
    expect(computeValueAtStake(diagnosis, { R0: 0, AOV: 10_000, L: 100 })).toBeNull();
    expect(computeValueAtStake(diagnosis, { R0: 1_000_000, AOV: -1, L: 100 })).toBeNull();
    expect(
      computeValueAtStake(diagnosis, { R0: 1_000_000, AOV: 10_000, L: 0 }),
    ).toBeNull();
    expect(
      computeValueAtStake(diagnosis, {
        R0: 1_000_000,
        AOV: 10_000,
        L: 100,
        RP: 0,
      }),
    ).toBeNull();
  });

  it("uses F0 = 1 when RP is absent", () => {
    const diagnosis = buildUniformDiagnosis(0.3);
    const withoutRepeat = computeValueAtStake(diagnosis, BASE_METRICS);
    const withExplicitOne = computeValueAtStake(diagnosis, { ...BASE_METRICS, RP: 1 });

    expect(withoutRepeat).not.toBeNull();
    expect(withExplicitOne).not.toBeNull();
    expect(withoutRepeat).toEqual(withExplicitOne);

    const impliedCr0 = 1_000_000 / 10_000 / 1 / 1_000;
    expect(impliedCr0).toBe(0.1);
    expect(withoutRepeat!.tier1.breakdown.repeat).toBeGreaterThan(0);
  });

  it("uses critical health floor when lever health is zero", () => {
    const diagnosis = buildUniformDiagnosis(0);
    const result = computeValueAtStake(diagnosis, BASE_METRICS);

    expect(result).not.toBeNull();
    expect(result!.tier1.monthly).toBeGreaterThan(0);
    expect(result!.tier1.breakdown.conversion).toBeGreaterThan(0);
  });

  it("caps conversion potential at 100%", () => {
    const diagnosis = buildUniformDiagnosis(0.1);
    const result = computeValueAtStake(diagnosis, {
      R0: 500_000,
      AOV: 10_000,
      L: 40,
    });

    expect(result).not.toBeNull();

    const customers0 = 40 * Math.min(500_000 / 10_000 / 1 / 40, 1);
    const maxConversionGain = 40 * (1 - customers0 / 40) * 10_000 * 1;

    expect(result!.tier1.breakdown.conversion).toBeLessThanOrEqual(
      Math.ceil(maxConversionGain) + 1,
    );
  });

  it("produces conservative headline and optimistic range high bound", () => {
    const diagnosis = buildUniformDiagnosis(0.3);
    const result = computeValueAtStake(diagnosis, BASE_METRICS);

    expect(result).not.toBeNull();
    expect(result!.tier1.monthly).toBe(result!.tier1.range.low);
    expect(result!.tier1.range.high).toBeGreaterThan(result!.tier1.range.low);
    expect(result!.tier1.annual).toBe(result!.tier1.monthly * 12);
    expect(result!.tier1.breakdown.conversion).toBeGreaterThan(0);
    expect(result!.tier1.breakdown.aov).toBeGreaterThan(0);
    expect(result!.tier1.breakdown.repeat).toBeGreaterThan(0);
  });

  it("widens the range when diagnosis confidence is low", () => {
    const diagnosis = buildUniformDiagnosis(0.3);
    const lowConfidence: StructuredDiagnosis = { ...diagnosis, confidence: "low" };
    const highConfidence: StructuredDiagnosis = { ...diagnosis, confidence: "high" };

    const low = computeValueAtStake(lowConfidence, BASE_METRICS);
    const high = computeValueAtStake(highConfidence, BASE_METRICS);

    expect(low).not.toBeNull();
    expect(high).not.toBeNull();

    const lowSpread = low!.tier1.range.high - low!.tier1.range.low;
    const highSpread = high!.tier1.range.high - high!.tier1.range.low;

    expect(lowSpread).toBeGreaterThan(highSpread);
    expect(low!.confidence).toBe("low");
  });

  it("returns qualitative tier2 and conditional tier3 without figures", () => {
    const diagnosis = buildUniformDiagnosis(0.8);
    const result = computeValueAtStake(diagnosis, BASE_METRICS);

    expect(result).not.toBeNull();
    expect(result!.tier2.qualitative.length).toBeGreaterThan(0);
    expect(result!.tier3.mechanism.length).toBeGreaterThan(0);
    expect(result!.tier3.conditions.length).toBeGreaterThan(0);
    expect(result!.tier2.qualitative).toContain("کیفی");
  });

  it("returns smaller tier1 for healthier diagnosis (honest small value)", () => {
    const weak = computeValueAtStake(buildUniformDiagnosis(0.2), BASE_METRICS);
    const healthy = computeValueAtStake(buildUniformDiagnosis(0.85), BASE_METRICS);

    expect(weak).not.toBeNull();
    expect(healthy).not.toBeNull();
    expect(healthy!.tier1.monthly).toBeLessThan(weak!.tier1.monthly);
  });
});
