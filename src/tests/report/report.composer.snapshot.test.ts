import { describe, expect, it } from "vitest";
import { domainsV1 } from "@/config/model-v1/domains";
import { computeValueAtStake } from "@/modules/report/value-at-stake.engine";
import { composeReport } from "@/modules/report/report.composer";
import { renderReport } from "@/modules/report/report.renderer";
import { computeLeadScore, buildExpertView } from "@/modules/report/expert-view";
import { contentLibraryV1 } from "@/modules/report/content-library";
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

function domainNamesMap(): Map<string, string> {
  return new Map(domainsV1.map((domain) => [domain.slug, domain.name]));
}

describe("composeReport snapshot", () => {
  it("matches stable ReportSpec for diagnosis v2 spec example", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    const reportSpec = composeReport({
      diagnosis,
      valueAtStake: null,
      answers: [],
      capacityMode: "free",
      domainNames: domainNamesMap(),
    });

    expect(reportSpec).toMatchSnapshot();
  });

  it("includes value-at-stake when metrics are provided", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    const valueAtStake = computeValueAtStake(diagnosis, {
      R0: 1_000_000,
      AOV: 10_000,
      L: 1_000,
    });

    const reportSpec = composeReport({
      diagnosis,
      valueAtStake,
      capacityMode: "free",
      domainNames: domainNamesMap(),
    });

    expect(reportSpec.valueAtStake).not.toBeNull();
    expect(reportSpec.expertView.leadScore).toBe("hot");
  });
});

describe("renderReport", () => {
  it("produces deterministic block order for spec example", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    const reportSpec = composeReport({
      diagnosis,
      domainNames: domainNamesMap(),
    });

    const viewModel = renderReport(reportSpec);

    expect(viewModel.blockOrder).toEqual([
      "survival-banner",
      "health-charts",
      "issues",
      "quick-win-teaser",
      "domain-breakdown",
      "quick-win-full",
      "locked-plan",
      "confidence-cta",
    ]);
    expect(viewModel.healthGauge.percentage).toBe(38);
    expect(viewModel.survivalBanner.message).toContain("بحرانی");
    expect(viewModel.confidenceNote.visible).toBe(true);
  });

  it("sets print presentation flags and expands all domains for print medium", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    const reportSpec = composeReport({
      diagnosis,
      domainNames: domainNamesMap(),
    });

    const viewModel = renderReport(reportSpec, { medium: "print" });

    expect(viewModel.medium).toBe("print");
    expect(viewModel.presentation).toEqual({
      expandAllDomains: true,
      hideInteractive: true,
      showPageBreakHints: true,
    });
    expect(viewModel.blockOrder).toEqual(
      renderReport(reportSpec, { medium: "app" }).blockOrder,
    );
    expect(viewModel.domainBreakdown.every((d) => d.expanded)).toBe(true);
  });
});

describe("buildExpertView", () => {
  it("scores RED survival as hot lead", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    expect(computeLeadScore(diagnosis, null)).toBe("hot");

    const expertView = buildExpertView({
      diagnosis,
      valueAtStake: null,
      capacityMode: "free",
      domainNames: domainNamesMap(),
      contentLibrary: contentLibraryV1,
    });

    expect(expertView.leadScore).toBe("hot");
    expect(expertView.appetizerActions.length).toBeGreaterThan(0);
    expect(expertView.suggestedOffer).toContain("تماس");
  });
});
