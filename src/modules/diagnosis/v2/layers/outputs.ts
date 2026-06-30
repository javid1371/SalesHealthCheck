import { DOMAIN_CONSTANTS, ISSUE_FAMILIES } from "@/config/model-v1/diagnosis-engine-v2";
import type {
  DiagnosisConfidence,
  GateAlert,
  IssueRootQuestion,
  PerDomainDiagnosis,
  PriorityLadderEntry,
  StructuredDiagnosis,
  SurvivalStatus,
} from "@/types/structured-diagnosis";
import type { SurvivalResult } from "./survival-gate";
import type { QuestionAnalysisResult } from "./question-analysis";
import { isWeakPct } from "./normalize";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function eligibleDomains(perDomain: PerDomainDiagnosis[]): PerDomainDiagnosis[] {
  return perDomain.filter((domain) => !domain.incomplete);
}

function buildPriorityLadder(
  perDomain: PerDomainDiagnosis[],
  survivalResult: SurvivalResult,
  gateAlerts: GateAlert[],
): PriorityLadderEntry[] {
  const eligible = eligibleDomains(perDomain);
  const ladder: PriorityLadderEntry[] = [];
  const used = new Set<number>();

  const redSurvival = eligible
    .filter(
      (domain) =>
        survivalResult.domainFlags[domain.engineId] === "RED",
    )
    .sort((a, b) => b.gap - a.gap);

  for (const domain of redSurvival) {
    ladder.push({
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      priorityTier: 0,
      reason: "survival_red",
    });
    used.add(domain.engineId);
  }

  const gateDomains = new Map<number, number>();
  for (const alert of gateAlerts) {
    gateDomains.set(alert.engineId, (gateDomains.get(alert.engineId) ?? 0) + 1);
  }

  const gateSorted = eligible
    .filter((domain) => gateDomains.has(domain.engineId) && !used.has(domain.engineId))
    .sort((a, b) => {
      const gateDiff = (gateDomains.get(b.engineId) ?? 0) - (gateDomains.get(a.engineId) ?? 0);
      if (gateDiff !== 0) return gateDiff;
      return b.gap - a.gap;
    });

  for (const domain of gateSorted) {
    ladder.push({
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      priorityTier: 1,
      reason: "gate_alert",
    });
    used.add(domain.engineId);
  }

  const piSorted = eligible
    .filter((domain) => !used.has(domain.engineId))
    .sort((a, b) => {
      if (b.PI !== a.PI) return b.PI - a.PI;
      return DOMAIN_CONSTANTS[b.engineId].R - DOMAIN_CONSTANTS[a.engineId].R;
    });

  for (const domain of piSorted) {
    ladder.push({
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      priorityTier: 2,
      reason: "priority_index",
    });
  }

  return ladder;
}

function selectPrimaryIssue(ladder: PriorityLadderEntry[]): number | null {
  return ladder[0]?.engineId ?? null;
}

function selectStructuralRoots(
  perDomain: PerDomainDiagnosis[],
  primaryIssue: number | null,
): number[] {
  return eligibleDomains(perDomain)
    .filter((domain) => domain.engineId !== primaryIssue)
    .filter((domain) => isWeakPct(domain.pct))
    .filter((domain) => {
      const constants = DOMAIN_CONSTANTS[domain.engineId];
      return constants.tier === "foundation" || constants.U >= 3;
    })
    .map((domain) => ({
      engineId: domain.engineId,
      score: domain.gap * DOMAIN_CONSTANTS[domain.engineId].U * DOMAIN_CONSTANTS[domain.engineId].kT,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.engineId);
}

function scoreQuickWinCandidate(domain: PerDomainDiagnosis): number {
  return domain.gap * DOMAIN_CONSTANTS[domain.engineId].Q;
}

function selectQuickWinLegacy(perDomain: PerDomainDiagnosis[]): number | null {
  const candidates = eligibleDomains(perDomain)
    .filter((domain) => domain.raw <= 9 && DOMAIN_CONSTANTS[domain.engineId].Q === 3)
    .map((domain) => ({
      engineId: domain.engineId,
      score: scoreQuickWinCandidate(domain),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.engineId ?? null;
}

function selectQuickWin(
  perDomain: PerDomainDiagnosis[],
  primaryIssue: number | null,
  structuralRoots: number[],
  bindingConstraint: number | null,
): number | null {
  const eligibleByEngineId = new Map(
    eligibleDomains(perDomain).map((domain) => [domain.engineId, domain]),
  );

  const priorityEngineIds = [
    primaryIssue,
    ...structuralRoots.slice(0, 2),
    bindingConstraint,
  ].filter((engineId): engineId is number => engineId !== null);

  const uniquePriorityIds = [...new Set(priorityEngineIds)];

  const priorityCandidates = uniquePriorityIds
    .map((engineId) => eligibleByEngineId.get(engineId))
    .filter((domain): domain is PerDomainDiagnosis => domain !== undefined)
    .map((domain) => ({
      engineId: domain.engineId,
      score: scoreQuickWinCandidate(domain),
    }))
    .sort((a, b) => b.score - a.score);

  if (priorityCandidates.length > 0) {
    return priorityCandidates[0]?.engineId ?? null;
  }

  return selectQuickWinLegacy(perDomain);
}

function buildIssueRootQuestions(
  perDomain: PerDomainDiagnosis[],
  questionAnalysis: QuestionAnalysisResult,
  primaryIssue: number | null,
  structuralRoots: number[],
  quickWin: number | null,
  gateAlerts: GateAlert[],
): IssueRootQuestion[] {
  const selectedEngineIds = new Map<number, IssueRootQuestion["role"]>();

  if (primaryIssue !== null) selectedEngineIds.set(primaryIssue, "primary_issue");
  for (const rootId of structuralRoots.slice(0, 2)) {
    if (!selectedEngineIds.has(rootId)) {
      selectedEngineIds.set(rootId, "structural_root");
    }
  }
  if (quickWin !== null && !selectedEngineIds.has(quickWin)) {
    selectedEngineIds.set(quickWin, "quick_win");
  }

  const results: IssueRootQuestion[] = [];

  for (const [engineId, role] of selectedEngineIds) {
    const gateForDomain = gateAlerts.find((alert) => alert.engineId === engineId);
    const weakForDomain = questionAnalysis.weakQuestions.filter(
      (question) => question.engineId === engineId,
    );

    if (gateForDomain) {
      results.push({
        engineId,
        displayOrder: gateForDomain.displayOrder,
        domainSlug: gateForDomain.domainSlug,
        questionNumber: gateForDomain.questionNumber,
        score: gateForDomain.score,
        diagnosticIntent: gateForDomain.diagnosticIntent,
        role,
      });
    }

    const remaining = weakForDomain
      .filter((question) => question.questionNumber !== gateForDomain?.questionNumber)
      .slice(0, gateForDomain ? 1 : 2);

    for (const question of remaining) {
      results.push({ ...question, role });
    }
  }

  return results;
}

function resolveConfidence(measurementDomain: PerDomainDiagnosis | undefined): {
  confidence: DiagnosisConfidence;
  instrumentFirst: boolean;
} {
  if (!measurementDomain) {
    return { confidence: "medium", instrumentFirst: false };
  }

  if (measurementDomain.level === "critical") {
    return { confidence: "low", instrumentFirst: true };
  }
  if (measurementDomain.level === "weak") {
    return { confidence: "medium", instrumentFirst: false };
  }
  return { confidence: "high", instrumentFirst: false };
}

export function buildFinalOutputs(input: {
  perDomain: PerDomainDiagnosis[];
  questionAnalysis: QuestionAnalysisResult;
  survivalResult: SurvivalResult;
  healthFlat: number;
  healthWeighted: number;
  bindingConstraint: number | null;
  dependencyFindings: StructuredDiagnosis["dependencyFindings"];
  incompleteDomains: number[];
}): StructuredDiagnosis {
  const {
    perDomain,
    questionAnalysis,
    survivalResult,
    healthFlat,
    healthWeighted,
    bindingConstraint,
    dependencyFindings,
    incompleteDomains,
  } = input;

  const priorityLadder = buildPriorityLadder(
    perDomain,
    survivalResult,
    questionAnalysis.gateAlerts,
  );
  const primaryIssue = selectPrimaryIssue(priorityLadder);
  const structuralRoots = selectStructuralRoots(perDomain, primaryIssue);
  const quickWin = selectQuickWin(
    perDomain,
    primaryIssue,
    structuralRoots,
    bindingConstraint,
  );
  const measurementDomain = perDomain.find((domain) => domain.engineId === 16);
  const { confidence, instrumentFirst } = resolveConfidence(measurementDomain);

  const issueFamilies = ISSUE_FAMILIES.map((family) => {
    const domainsInFamily = perDomain.filter((domain) =>
      family.engineIds.some((id) => id === domain.engineId),
    );
    const averagePct =
      domainsInFamily.length === 0
        ? 0
        : domainsInFamily.reduce((sum, domain) => sum + domain.pct, 0) /
          domainsInFamily.length;

    return {
      key: family.key,
      label: family.label,
      engineIds: [...family.engineIds],
      averagePct: round(averagePct, 4),
    };
  });

  return {
    engineVersion: "v2",
    perDomain: perDomain.map((domain) => ({
      ...domain,
      pct: round(domain.pct, 4),
      gap: round(domain.gap, 4),
      W: round(domain.W, 2),
      M: round(domain.M, 2),
      PI: round(domain.PI, 2),
    })),
    weakQuestions: questionAnalysis.weakQuestions,
    subdomainPattern: questionAnalysis.subdomainPattern,
    gateAlerts: questionAnalysis.gateAlerts,
    issueRootQuestions: buildIssueRootQuestions(
      perDomain,
      questionAnalysis,
      primaryIssue,
      structuralRoots,
      quickWin,
      questionAnalysis.gateAlerts,
    ),
    priorityLadder,
    healthFlat: round(healthFlat, 4),
    healthWeighted: round(healthWeighted, 4),
    survivalStatus: survivalResult.survivalStatus as SurvivalStatus,
    survivalAlerts: survivalResult.survivalAlerts,
    primaryIssue,
    structuralRoots,
    quickWin,
    bindingConstraint,
    dependencyFindings,
    issueFamilies,
    confidence,
    instrumentFirst,
    incompleteDomains,
  };
}
