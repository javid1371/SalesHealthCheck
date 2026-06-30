import { describe, expect, it } from "vitest";
import { domainsV1 } from "@/config/model-v1/domains";
import { questionsV1 } from "@/config/model-v1/questions";
import { getReportContentBundleBySlug } from "@/config/model-v1/report-content/report-content-library.v1";
import { runDiagnosisV2FromRawScores } from "@/modules/diagnosis/v2/run-diagnosis-v2";
import {
  getSelectedAnswerOption,
  getTriggeredRootCauses,
} from "@/modules/report/content-library";
import {
  composeReport,
  type ComposeReportInput,
} from "@/modules/report/report.composer";
import type {
  DomainBreakdownEntry,
  ReportSpec,
} from "@/types/report-spec";

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

const INTERNAL_FIELD_MARKERS = [
  "internal_diagnosis_summary_fa",
  "internal_diagnosis_fa",
  "rendering_rules_fa",
] as const;

function domainNamesMap(): Map<string, string> {
  return new Map(domainsV1.map((domain) => [domain.slug, domain.name]));
}

function baseComposeInput(
  overrides: Partial<ComposeReportInput> = {},
): ComposeReportInput {
  const diagnosis =
    overrides.diagnosis ??
    runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

  return {
    diagnosis,
    valueAtStake: null,
    answers: [],
    capacityMode: "free",
    domainNames: domainNamesMap(),
    ...overrides,
  };
}

function composeExampleReport(
  overrides: Partial<ComposeReportInput> = {},
): ReportSpec {
  return composeReport(baseComposeInput(overrides));
}

function findDomainBreakdown(
  report: ReportSpec,
  domainSlug: string,
): DomainBreakdownEntry | undefined {
  return report.domainBreakdown.find((entry) => entry.domainSlug === domainSlug);
}

function assertNonEmptyString(value: unknown, label: string): void {
  expect(typeof value).toBe("string");
  expect((value as string).trim().length).toBeGreaterThan(0);
}

describe("report composer contract", () => {
  it("does not expose internal diagnosis fields in user-facing output", () => {
    const report = composeExampleReport({
      answers: [{ domainSlug: "persona", questionNumber: 1, score: 0 }],
    });
    const serialized = JSON.stringify(report);

    for (const marker of INTERNAL_FIELD_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });

  it("triggers the correct root cause when a weak answer is provided", () => {
    const report = composeExampleReport({
      answers: [{ domainSlug: "persona", questionNumber: 1, score: 0 }],
    });
    const persona = findDomainBreakdown(report, "persona");

    expect(
      persona?.rootCauses?.some(
        (rootCause) => rootCause.rootId === "undefined_good_customer",
      ),
    ).toBe(true);
  });

  it("maps selected_score to the correct answer option", () => {
    const bundle = getReportContentBundleBySlug("persona");
    expect(bundle).toBeDefined();

    const bankQuestion = questionsV1.find(
      (question) =>
        question.domainSlug === "persona" && question.displayOrder === 1,
    );
    const bankOption = bankQuestion?.options.find((option) => option.score === 0);

    const selected = getSelectedAnswerOption(bundle!, "persona_q1", 0);

    expect(selected.text_fa).toBe(bankOption?.text);
    expect(selected.public_reflection_fa).toContain("پاسخ شما");

    const triggered = getTriggeredRootCauses(bundle!, [
      { question_id: "persona_q1", selected_score: 0 },
    ]);
    expect(triggered[0]?.evidence[0]?.selected_option_text_fa).toBe(
      bankOption?.text,
    );
  });

  it("shows full action only for the quick win domain", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });
    const report = composeExampleReport({
      diagnosis: { ...diagnosis, quickWin: 2 },
    });

    const persona = findDomainBreakdown(report, "persona");
    const uvp = findDomainBreakdown(report, "uvp");

    expect(persona?.quickWinAction?.fullAction).toBeDefined();
    expect(persona?.quickWinAction?.fullAction?.length).toBeGreaterThan(0);
    expect(uvp?.quickWinAction).toBeUndefined();
    expect(uvp?.lockedActionTeaser).toBeDefined();
  });

  it("shows locked teaser only for non-quick-win domains", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });
    const quickWinEngineId = diagnosis.quickWin;
    const report = composeExampleReport({ diagnosis });

    for (const domain of report.domainBreakdown) {
      if (domain.engineId === quickWinEngineId) {
        expect(domain.quickWinAction).toBeDefined();
        expect(domain.lockedActionTeaser).toBeUndefined();
        expect(domain.fixLock.locked).toBe(false);
        continue;
      }

      expect(domain.quickWinAction).toBeUndefined();
      expect(domain.lockedActionTeaser).toBeDefined();
      expect(domain.fixLock.locked).toBe(true);
    }
  });

  it("does not render null or undefined in bundle-backed user-facing fields", () => {
    const report = composeExampleReport({
      answers: [
        { domainSlug: "persona", questionNumber: 1, score: 0 },
        { domainSlug: "persona", questionNumber: 2, score: 1 },
        { domainSlug: "uvp", questionNumber: 1, score: 0 },
      ],
    });

    for (const domain of report.domainBreakdown) {
      if (domain.levelHeadline !== undefined) {
        assertNonEmptyString(domain.levelHeadline, "levelHeadline");
      }

      if (domain.lockedActionTeaser !== undefined) {
        assertNonEmptyString(domain.lockedActionTeaser, "lockedActionTeaser");
      }

      if (domain.quickWinAction) {
        assertNonEmptyString(
          domain.quickWinAction.actionTitle,
          "quickWinAction.actionTitle",
        );
        assertNonEmptyString(
          domain.quickWinAction.quickWinSummary,
          "quickWinAction.quickWinSummary",
        );
      }

      for (const rootCause of domain.rootCauses ?? []) {
        assertNonEmptyString(rootCause.publicRootSentence, "publicRootSentence");
        assertNonEmptyString(rootCause.mechanism, "mechanism");
        assertNonEmptyString(rootCause.salesImpact, "salesImpact");

        for (const evidence of rootCause.evidence) {
          assertNonEmptyString(evidence.evidenceSentence, "evidenceSentence");
          assertNonEmptyString(evidence.publicReflection, "publicReflection");
        }
      }
    }
  });

  it("produces deterministic output for the same input", () => {
    const input = baseComposeInput({
      answers: [{ domainSlug: "persona", questionNumber: 1, score: 0 }],
    });

    const first = composeReport(input);
    const second = composeReport(input);

    expect(first).toEqual(second);
  });

  it("does not recalculate domain scores from answers", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });
    const report = composeExampleReport({
      diagnosis,
      answers: [
        { domainSlug: "persona", questionNumber: 1, score: 3 },
        { domainSlug: "persona", questionNumber: 2, score: 3 },
        { domainSlug: "persona", questionNumber: 3, score: 3 },
        { domainSlug: "persona", questionNumber: 4, score: 3 },
        { domainSlug: "persona", questionNumber: 5, score: 3 },
      ],
    });

    for (const domain of diagnosis.perDomain) {
      const entry = report.domainBreakdown.find(
        (candidate) => candidate.engineId === domain.engineId,
      );

      expect(entry?.rawScore).toBe(domain.raw);
      expect(entry?.percentage).toBe(Math.round(domain.pct * 100));
      expect(entry?.level).toBe(domain.level);
    }
  });

  it("deduplicates issues when binding constraint matches primary issue", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });
    const report = composeExampleReport({ diagnosis });

    const engineIds = report.issues.map((issue) => issue.engineId);
    expect(new Set(engineIds).size).toBe(engineIds.length);

    if (diagnosis.bindingConstraint === diagnosis.primaryIssue) {
      expect(
        report.issues.some((issue) => issue.role === "binding_constraint"),
      ).toBe(false);
    }
  });

  it("uses public_summary_fa for issue mechanism when bundle exists", () => {
    const report = composeExampleReport();
    const primary = report.issues.find((issue) => issue.role === "primary_issue");
    expect(primary).toBeDefined();

    const bundle = getReportContentBundleBySlug(primary!.domainSlug);
    expect(primary?.mechanism).toBe(bundle?.public_summary_fa);
  });

  it("populates symptomsList from domain bundle", () => {
    const report = composeExampleReport();

    for (const domain of report.domainBreakdown) {
      const bundle = getReportContentBundleBySlug(domain.domainSlug);
      expect(domain.symptomsList).toEqual(bundle?.symptoms);
      expect(domain.symptomsList?.length).toBeGreaterThan(0);
    }
  });

  it("aligns diagnosis quickWin with prioritized domains", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });

    const priorityIds = new Set(
      [
        diagnosis.primaryIssue,
        ...diagnosis.structuralRoots.slice(0, 2),
        diagnosis.bindingConstraint,
      ].filter((engineId): engineId is number => engineId !== null),
    );

    expect(diagnosis.quickWin).not.toBeNull();
    expect(priorityIds.has(diagnosis.quickWin!)).toBe(true);
  });

  it("does not create new diagnosis — report mirrors StructuredDiagnosis roles", () => {
    const diagnosis = runDiagnosisV2FromRawScores({
      rawByEngineId: SPEC_EXAMPLE_RAW_BY_ENGINE_ID,
    });
    const report = composeExampleReport({ diagnosis });

    const primaryIssue = report.issues.find(
      (issue) => issue.role === "primary_issue",
    );
    const structuralRoots = report.issues.filter(
      (issue) => issue.role === "structural_root",
    );
    const bindingConstraint = report.issues.find(
      (issue) => issue.role === "binding_constraint",
    );

    expect(primaryIssue?.engineId).toBe(diagnosis.primaryIssue);
    expect(structuralRoots.map((issue) => issue.engineId)).toEqual(
      diagnosis.structuralRoots.slice(0, 2),
    );
    if (diagnosis.bindingConstraint !== diagnosis.primaryIssue) {
      expect(bindingConstraint?.engineId).toBe(diagnosis.bindingConstraint);
    } else {
      expect(bindingConstraint).toBeUndefined();
    }
    expect(report.healthDisplay).toBe(Math.round(diagnosis.healthWeighted * 100));
    expect(report.survivalBanner.status).toBe(diagnosis.survivalStatus);
    expect(report.domainBreakdown).toHaveLength(diagnosis.perDomain.length);
  });
});
