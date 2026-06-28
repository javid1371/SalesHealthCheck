import {
  ENGINE_IDS,
  engineIdToSlug,
} from "@/config/model-v1/diagnosis-engine-v2";
import { questionsV1 } from "@/config/model-v1/questions";
import {
  lockedFixLabel,
  quickWinFixLockLabel,
  resolveToneMode,
} from "@/config/model-v1/report-content/tone-templates";
import { getCtaDestination } from "@/config/model-v1/report-content/cta-templates";
import {
  contentLibraryV1,
  type ContentLibraryV1,
} from "@/modules/report/content-library";
import { buildExpertView } from "@/modules/report/expert-view";
import type {
  CapacityMode,
  DomainBreakdownEntry,
  DomainEvidence,
  ReportChart,
  ReportCta,
  ReportIssue,
  ReportSpec,
} from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";

export type ComposerAnswerInput = {
  domainSlug: string;
  questionNumber: number;
  score: 0 | 1 | 2 | 3;
};

export type ComposeReportInput = {
  diagnosis: StructuredDiagnosis;
  valueAtStake?: ValueAtStakeSpec | null;
  answers?: ComposerAnswerInput[];
  capacityMode?: CapacityMode;
  domainNames: Map<string, string>;
  contentLibrary?: ContentLibraryV1;
};

function isDomainExpanded(level: StructuredDiagnosis["perDomain"][0]["level"]): boolean {
  return level === "critical" || level === "weak" || level === "medium";
}

function resolveDomainName(
  engineId: number,
  domainNames: Map<string, string>,
): string {
  const slug = engineIdToSlug(engineId);
  return domainNames.get(slug) ?? slug;
}

function findIssueFamilyLabel(
  diagnosis: StructuredDiagnosis,
  engineId: number,
): string {
  const family = diagnosis.issueFamilies.find((entry) =>
    entry.engineIds.includes(engineId),
  );
  return family?.label ?? "";
}

function lookupQuestion(domainSlug: string, questionNumber: number) {
  return questionsV1.find(
    (question) =>
      question.domainSlug === domainSlug &&
      question.displayOrder === questionNumber,
  );
}

function buildSelectedOptionText(
  domainSlug: string,
  questionNumber: number,
  score: 0 | 1 | 2 | 3,
  contentLibrary: ContentLibraryV1,
  level: StructuredDiagnosis["perDomain"][0]["level"],
): string {
  const question = lookupQuestion(domainSlug, questionNumber);
  const option = question?.options.find((entry) => entry.score === score);
  if (option?.text) {
    return option.text;
  }

  return contentLibrary.resolveOptionInterpretation(
    domainSlug,
    questionNumber,
    score,
    level,
  );
}

function buildDomainEvidence(
  domainSlug: string,
  level: StructuredDiagnosis["perDomain"][0]["level"],
  answers: ComposerAnswerInput[],
  diagnosis: StructuredDiagnosis,
  contentLibrary: ContentLibraryV1,
): DomainEvidence[] {
  const domainAnswers = answers
    .filter((answer) => answer.domainSlug === domainSlug)
    .sort((a, b) => a.questionNumber - b.questionNumber);

  if (domainAnswers.length > 0) {
    return domainAnswers.map((answer) => {
      const question = lookupQuestion(domainSlug, answer.questionNumber);
      const rootFromDiagnosis = diagnosis.issueRootQuestions.find(
        (entry) =>
          entry.domainSlug === domainSlug &&
          entry.questionNumber === answer.questionNumber,
      );

      return {
        questionNumber: answer.questionNumber,
        questionText: question?.text ?? "",
        selectedScore: answer.score,
        selectedOptionText: buildSelectedOptionText(
          domainSlug,
          answer.questionNumber,
          answer.score,
          contentLibrary,
          level,
        ),
        selectedInterpretation: contentLibrary.resolveOptionInterpretation(
          domainSlug,
          answer.questionNumber,
          answer.score,
          level,
        ),
        rootSentence: contentLibrary.resolveDiagnosticIntent(
          domainSlug,
          answer.questionNumber,
          level,
          rootFromDiagnosis?.diagnosticIntent,
        ),
      };
    });
  }

  const weakForDomain = diagnosis.weakQuestions
    .filter((question) => question.domainSlug === domainSlug)
    .slice(0, 2);

  return weakForDomain.map((question) => ({
    questionNumber: question.questionNumber,
    questionText:
      lookupQuestion(domainSlug, question.questionNumber)?.text ?? "",
    selectedScore: question.score as 0 | 1 | 2 | 3,
    selectedOptionText: buildSelectedOptionText(
      domainSlug,
      question.questionNumber,
      question.score as 0 | 1 | 2 | 3,
      contentLibrary,
      level,
    ),
    selectedInterpretation: contentLibrary.resolveOptionInterpretation(
      domainSlug,
      question.questionNumber,
      question.score as 0 | 1 | 2 | 3,
      level,
    ),
    rootSentence: contentLibrary.resolveDiagnosticIntent(
      domainSlug,
      question.questionNumber,
      level,
      question.diagnosticIntent,
    ),
  }));
}

function findRootSentenceForEngine(
  diagnosis: StructuredDiagnosis,
  engineId: number,
  domainSlug: string,
  level: StructuredDiagnosis["perDomain"][0]["level"],
  contentLibrary: ContentLibraryV1,
): string {
  const fromIssueRoot = diagnosis.issueRootQuestions.find(
    (entry) => entry.engineId === engineId,
  );

  if (fromIssueRoot?.diagnosticIntent) {
    return contentLibrary.resolveDiagnosticIntent(
      domainSlug,
      fromIssueRoot.questionNumber,
      level,
      fromIssueRoot.diagnosticIntent,
    );
  }

  const weak = diagnosis.weakQuestions.find(
    (entry) => entry.engineId === engineId,
  );
  if (weak) {
    return contentLibrary.resolveDiagnosticIntent(
      domainSlug,
      weak.questionNumber,
      level,
      weak.diagnosticIntent,
    );
  }

  return contentLibrary.resolveDiagnosticIntent(domainSlug, 1, level);
}

function buildIssue(
  role: ReportIssue["role"],
  engineId: number | null,
  diagnosis: StructuredDiagnosis,
  domainNames: Map<string, string>,
  contentLibrary: ContentLibraryV1,
): ReportIssue | null {
  if (engineId === null) return null;

  const domain = diagnosis.perDomain.find((entry) => entry.engineId === engineId);
  if (!domain) return null;

  const domainSlug = domain.domainSlug;
  const level = domain.level;

  return {
    role,
    engineId,
    domainSlug,
    domainName: resolveDomainName(engineId, domainNames),
    level,
    mechanism: contentLibrary.resolveDiagnosticSymptoms(domainSlug, level),
    rootSentence: findRootSentenceForEngine(
      diagnosis,
      engineId,
      domainSlug,
      level,
      contentLibrary,
    ),
    costHint: contentLibrary.resolveQualitativeCost(domainSlug, level),
  };
}

function buildIssues(
  diagnosis: StructuredDiagnosis,
  domainNames: Map<string, string>,
  contentLibrary: ContentLibraryV1,
): ReportIssue[] {
  const issues: ReportIssue[] = [];

  const primary = buildIssue(
    "primary_issue",
    diagnosis.primaryIssue,
    diagnosis,
    domainNames,
    contentLibrary,
  );
  if (primary) issues.push(primary);

  for (const engineId of diagnosis.structuralRoots.slice(0, 2)) {
    const root = buildIssue(
      "structural_root",
      engineId,
      diagnosis,
      domainNames,
      contentLibrary,
    );
    if (root) issues.push(root);
  }

  const binding = buildIssue(
    "binding_constraint",
    diagnosis.bindingConstraint,
    diagnosis,
    domainNames,
    contentLibrary,
  );
  if (binding) issues.push(binding);

  return issues;
}

function buildDomainBreakdown(
  diagnosis: StructuredDiagnosis,
  answers: ComposerAnswerInput[],
  domainNames: Map<string, string>,
  quickWinEngineId: number | null,
  capacityMode: CapacityMode,
  contentLibrary: ContentLibraryV1,
): DomainBreakdownEntry[] {
  const destination = getCtaDestination(capacityMode);
  const sortedDomains = [...diagnosis.perDomain].sort(
    (a, b) =>
      ENGINE_IDS.indexOf(a.engineId as (typeof ENGINE_IDS)[number]) -
      ENGINE_IDS.indexOf(b.engineId as (typeof ENGINE_IDS)[number]),
  );

  return sortedDomains.map((domain) => {
    const isQuickWin = domain.engineId === quickWinEngineId;
    const locked = !isQuickWin;

    return {
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      domainName: resolveDomainName(domain.engineId, domainNames),
      rawScore: domain.raw,
      percentage: Math.round(domain.pct * 100),
      level: domain.level,
      tier: domain.tier,
      family: findIssueFamilyLabel(diagnosis, domain.engineId),
      incomplete: domain.incomplete,
      expanded: isDomainExpanded(domain.level),
      symptoms: contentLibrary.resolveDiagnosticSymptoms(
        domain.domainSlug,
        domain.level,
      ),
      evidence: buildDomainEvidence(
        domain.domainSlug,
        domain.level,
        answers,
        diagnosis,
        contentLibrary,
      ),
      interpretation: contentLibrary.resolveDomainScoreBand(
        domain.domainSlug,
        domain.raw,
        domain.level,
      ),
      qualitativeCost: contentLibrary.resolveQualitativeCost(
        domain.domainSlug,
        domain.level,
      ),
      fixLock: {
        locked,
        label: isQuickWin ? quickWinFixLockLabel : lockedFixLabel,
        destination,
      },
    };
  });
}

function buildLockedPlanTitles(
  diagnosis: StructuredDiagnosis,
  domainNames: Map<string, string>,
  quickWinEngineId: number | null,
): string[] {
  const lockedIds: number[] = [];
  const seen = new Set<number>();

  const add = (engineId: number | null) => {
    if (engineId === null || engineId === quickWinEngineId || seen.has(engineId)) {
      return;
    }
    seen.add(engineId);
    lockedIds.push(engineId);
  };

  add(diagnosis.primaryIssue);
  for (const engineId of diagnosis.structuralRoots) add(engineId);
  for (const entry of diagnosis.priorityLadder) add(entry.engineId);

  return lockedIds.slice(0, 5).map((engineId) =>
    resolveDomainName(engineId, domainNames),
  );
}

function buildCharts(
  diagnosis: StructuredDiagnosis,
  domainNames: Map<string, string>,
  healthDisplay: number,
): ReportChart[] {
  const radarDomains = [...diagnosis.perDomain]
    .sort(
      (a, b) =>
        ENGINE_IDS.indexOf(a.engineId as (typeof ENGINE_IDS)[number]) -
        ENGINE_IDS.indexOf(b.engineId as (typeof ENGINE_IDS)[number]),
    )
    .map((domain) => ({
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      domainName: resolveDomainName(domain.engineId, domainNames),
      percentage: Math.round(domain.pct * 100),
      level: domain.level,
    }));

  return [
    {
      kind: "survival",
      data: {
        status: diagnosis.survivalStatus,
        alerts: diagnosis.survivalAlerts,
      },
    },
    {
      kind: "health-gauge",
      data: {
        percentage: healthDisplay,
        survivalStatus: diagnosis.survivalStatus,
        healthWeighted: diagnosis.healthWeighted,
      },
    },
    {
      kind: "radar",
      data: { domains: radarDomains },
    },
    {
      kind: "funnel-leak",
      data: {
        stages: radarDomains.map((domain) => ({
          engineId: domain.engineId,
          domainSlug: domain.domainSlug,
          domainName: domain.domainName,
          percentage: domain.percentage,
          level: domain.level,
        })),
      },
    },
    {
      kind: "issue-family",
      data: {
        families: diagnosis.issueFamilies.map((family) => ({
          key: family.key,
          label: family.label,
          averagePct: Math.round(family.averagePct * 100),
          engineIds: family.engineIds,
        })),
      },
    },
  ];
}

function toReportCta(
  spec: ReturnType<ContentLibraryV1["buildCtaSpec"]>,
): ReportCta {
  return {
    moment: spec.moment,
    headline: spec.headline,
    destination: spec.destination,
    personalization: spec.personalization,
  };
}

function buildCtas(
  issues: ReportIssue[],
  capacityMode: CapacityMode,
  contentLibrary: ContentLibraryV1,
): ReportCta[] {
  const bindingIssue = issues.find((issue) => issue.role === "binding_constraint");
  const structuralNames = issues
    .filter((issue) => issue.role === "structural_root")
    .map((issue) => issue.domainName);

  const urgencyInput = {
    bindingConstraintDomainName: bindingIssue?.domainName,
    bindingConstraintRootSentence: bindingIssue?.rootSentence,
    structuralRootDomainNames: structuralNames,
  };

  return [
    toReportCta(contentLibrary.buildCtaSpec("urgency", capacityMode, urgencyInput)),
    toReportCta(contentLibrary.buildCtaSpec("trust", capacityMode, urgencyInput)),
  ];
}

/**
 * Pure Composer: selects blocks, ordering, tone, and disclosure level.
 * Makes no diagnostic decisions — consumes StructuredDiagnosis as-is.
 */
export function composeReport(input: ComposeReportInput): ReportSpec {
  const {
    diagnosis,
    valueAtStake = null,
    answers = [],
    capacityMode = "free",
    domainNames,
    contentLibrary = contentLibraryV1,
  } = input;

  const healthDisplay = Math.round(diagnosis.healthWeighted * 100);
  const quickWinEngineId = diagnosis.quickWin;
  const issues = buildIssues(diagnosis, domainNames, contentLibrary);

  let quickWinTeaser: ReportSpec["quickWinTeaser"] = null;
  let quickWin: ReportSpec["quickWin"] = null;

  if (quickWinEngineId !== null) {
    const slug = engineIdToSlug(quickWinEngineId);
    const domainName = resolveDomainName(quickWinEngineId, domainNames);
    const level =
      diagnosis.perDomain.find((d) => d.engineId === quickWinEngineId)?.level ??
      "weak";

    quickWinTeaser = { domainSlug: slug, domainName };
    quickWin = {
      domainSlug: slug,
      domainName,
      actionText: contentLibrary.resolveCorrectiveAction(slug, level),
    };
  }

  const expertView = buildExpertView({
    diagnosis,
    valueAtStake,
    capacityMode,
    domainNames,
    contentLibrary,
  });

  return {
    survivalBanner: {
      status: diagnosis.survivalStatus,
      tone: resolveToneMode(diagnosis.survivalStatus, diagnosis.confidence),
    },
    healthDisplay,
    charts: buildCharts(diagnosis, domainNames, healthDisplay),
    quickWinTeaser,
    issues,
    domainBreakdown: buildDomainBreakdown(
      diagnosis,
      answers,
      domainNames,
      quickWinEngineId,
      capacityMode,
      contentLibrary,
    ),
    valueAtStake,
    quickWin,
    lockedPlan: {
      titles: buildLockedPlanTitles(
        diagnosis,
        domainNames,
        quickWinEngineId,
      ),
    },
    ctas: buildCtas(issues, capacityMode, contentLibrary),
    capacityMode,
    confidenceNote: {
      level: diagnosis.confidence,
      instrumentFirst: diagnosis.instrumentFirst,
    },
    expertView,
  };
}
