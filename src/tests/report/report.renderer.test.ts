import { describe, expect, it } from "vitest";
import { domainsV1 } from "@/config/model-v1/domains";
import { composeReport } from "@/modules/report/report.composer";
import { renderReport } from "@/modules/report/report.renderer";
import { runDiagnosisV2FromRawScores } from "@/modules/diagnosis/v2/run-diagnosis-v2";

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

function exampleReportSpec() {
  const diagnosis = runDiagnosisV2FromRawScores({
    rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
  });

  return composeReport({
    diagnosis,
    domainNames: domainNamesMap(),
  });
}

describe("renderReport variants", () => {
  it("orders full report blocks with metrics gate and separated confidence", () => {
    const viewModel = renderReport(exampleReportSpec(), { variant: "full" });

    expect(viewModel.blockOrder).toEqual([
      "survival-banner",
      "health-charts",
      "issues",
      "metrics-gate",
      "quick-win",
      "domain-breakdown",
      "locked-plan",
      "confidence-note",
      "cta",
    ]);
    expect(viewModel.ctas).toHaveLength(1);
    expect(viewModel.ctas[0]?.destination).toBe("consultation");
  });

  it("orders summary dashboard blocks without charts or domain breakdown", () => {
    const viewModel = renderReport(exampleReportSpec(), { variant: "summary" });

    expect(viewModel.blockOrder).toEqual([
      "survival-banner",
      "health-gauge",
      "issues",
      "quick-win",
      "value-stake-teaser",
      "summary-actions",
    ]);
    expect(viewModel.presentation.compactIssues).toBe(true);
  });

  it("enriches survival chart alerts with domain names", () => {
    const viewModel = renderReport(exampleReportSpec(), { variant: "full" });
    const survival = viewModel.charts.find((chart) => chart.kind === "survival");
    expect(survival).toBeDefined();

    const data = survival?.data as {
      alerts: Array<{ domainSlug: string; domainName?: string }>;
    };
    expect(data.alerts.length).toBeGreaterThan(0);
    expect(data.alerts.every((alert) => Boolean(alert.domainName))).toBe(true);
  });

  it("sets print presentation flags and expands all domains", () => {
    const spec = exampleReportSpec();
    const viewModel = renderReport(spec, { medium: "print", variant: "full" });

    expect(viewModel.presentation).toEqual({
      expandAllDomains: true,
      hideInteractive: true,
      showPageBreakHints: true,
      compactIssues: false,
    });
    expect(viewModel.domainBreakdown.every((d) => d.expanded)).toBe(true);
  });
});
