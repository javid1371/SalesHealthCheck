import { describe, expect, it } from "vitest";
import {
  DB_DISPLAY_ORDER_TO_ENGINE_ID,
  ENGINE_ID_TO_SLUG,
  ENGINE_IDS,
} from "@/config/model-v1/diagnosis-engine-v2";
import { domainsV1 } from "@/config/model-v1/domains";
import { runDiagnosisV2FromRawScores } from "@/modules/diagnosis/v2/run-diagnosis-v2";

/** Worked example from docs/specs/diagnosis-engine-v2-spec.md */
const SPEC_EXAMPLE_RAW_BY_ENGINE_ID: Record<number, number> = {
  1: 6,
  2: 4,
  3: 5,
  4: 8,
  5: 9,
  6: 4,
  7: 3,
  8: 7,
  9: 8,
  10: 6,
  11: 7,
  12: 5,
  13: 6,
  14: 3,
  15: 7,
  16: 2,
};

describe("diagnosis engine v2 snapshot example", () => {
  it("matches spec worked example outputs (domain-level raw only)", () => {
    const result = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    expect(result.survivalStatus).toBe("RED");
    expect(result.primaryIssue).toBe(7);
    expect(result.structuralRoots.slice(0, 2)).toEqual([16, 2]);
    expect(result.quickWin).toBe(7);
    expect(result.bindingConstraint).toBe(7);
    expect(result.confidence).toBe("low");
    expect(result.instrumentFirst).toBe(true);
    expect(result.gateAlerts).toHaveLength(0);

    const engine7 = result.perDomain.find((domain) => domain.engineId === 7);
    expect(engine7?.PI).toBeCloseTo(4.24, 2);
  });
});

describe("domain crosswalk", () => {
  it("maps all domain display orders to engine ids", () => {
    for (const domain of domainsV1) {
      const engineId = DB_DISPLAY_ORDER_TO_ENGINE_ID[domain.displayOrder];
      expect(engineId).toBeDefined();
      expect(ENGINE_ID_TO_SLUG[engineId]).toBe(domain.slug);
    }
  });

  it("covers all 16 engine ids", () => {
    expect(ENGINE_IDS).toHaveLength(16);
    const mappedEngineIds = new Set(Object.values(DB_DISPLAY_ORDER_TO_ENGINE_ID));
    expect(mappedEngineIds.size).toBe(16);
  });
});
