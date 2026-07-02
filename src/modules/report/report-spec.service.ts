import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { HealthLevel } from "@/types/assessment";
import type { BottleneckResult } from "@/types/diagnosis";
import type { StructuredReport } from "@/types/report";
import type { ReportSpec } from "@/types/report-spec";
import type {
  DomainLevel,
  StructuredDiagnosis,
  SurvivalStatus,
  VitalityTier,
} from "@/types/structured-diagnosis";
import type {
  DomainScoreResult,
  LayerScoreResult,
  OverallScoreResult,
} from "@/types/scoring";
import {
  SLUG_TO_ENGINE_ID,
} from "@/config/model-v1/diagnosis-engine-v2/domain-crosswalk";
import {
  findAssessmentForResult,
  findReportById,
  getAnswersWithDetails,
  updateReportSpec,
} from "@/modules/assessment/assessment.repository";
import {
  loadDomainsWithQuestions,
  loadLayers,
} from "@/modules/question-bank/question-bank.repository";
import {
  buildReportSpec,
  type ComposerAnswerInput,
} from "@/modules/report/report.builder";
import { computeValueAtStake } from "@/modules/report/value-at-stake.engine";
import type { ValueAtStakeInput } from "@/types/value-at-stake";

export function parseReportSpec(value: unknown): ReportSpec | null {
  if (!value || typeof value !== "object") return null;
  return value as ReportSpec;
}

export function hasRadarChart(reportSpec: ReportSpec | null | undefined): boolean {
  return (
    reportSpec?.charts?.some((chart) => chart.kind === "radar") ?? false
  );
}

function toComposerAnswers(
  answers: Awaited<ReturnType<typeof getAnswersWithDetails>>,
): ComposerAnswerInput[] {
  return answers.map((answer) => ({
    domainSlug: answer.question.domain.slug,
    questionNumber: answer.question.displayOrder,
    score: answer.scoreSnapshot as 0 | 1 | 2 | 3,
  }));
}

function toValueAtStakeInput(session: {
  monthlyRevenue: number | null;
  averageOrderValue: number | null;
  monthlyLeads: number | null;
  repeatPurchaseRate: number | null;
}): ValueAtStakeInput | null {
  if (
    session.monthlyRevenue == null ||
    session.averageOrderValue == null ||
    session.monthlyLeads == null
  ) {
    return null;
  }

  return {
    R0: session.monthlyRevenue,
    AOV: session.averageOrderValue,
    L: session.monthlyLeads,
    RP: session.repeatPurchaseRate ?? undefined,
  };
}

function mapDomainScores(
  assessment: NonNullable<Awaited<ReturnType<typeof findAssessmentForResult>>>,
): DomainScoreResult[] {
  return assessment.domainScores.map((score) => ({
    domainId: score.domainId,
    domainSlug: score.domain.slug,
    rawScore: score.rawScore,
    maxScore: score.maxScore,
    percentage: score.percentage,
    healthLevel: score.healthLevel as HealthLevel,
  }));
}

function mapLayerScores(
  assessment: NonNullable<Awaited<ReturnType<typeof findAssessmentForResult>>>,
  layers: Awaited<ReturnType<typeof loadLayers>>,
): LayerScoreResult[] {
  const layerSlugById = new Map(layers.map((layer) => [layer.id, layer.slug]));

  return assessment.layerScores.map((score) => ({
    layerId: score.layerId,
    layerSlug: layerSlugById.get(score.layerId) ?? score.layer.slug,
    rawScore: score.rawScore,
    maxScore: score.maxScore,
    percentage: score.percentage,
    healthLevel: score.healthLevel as HealthLevel,
  }));
}

function mapBottlenecks(
  assessment: NonNullable<Awaited<ReturnType<typeof findAssessmentForResult>>>,
): BottleneckResult[] {
  return assessment.bottlenecks.map((bottleneck) => ({
    domainId: bottleneck.domainId,
    domainSlug: bottleneck.domain.slug,
    domainName: bottleneck.domain.name,
    weaknessScore: bottleneck.weaknessScore,
    domainWeight: bottleneck.domainWeight,
    priorityScore: bottleneck.priorityScore,
    rank: bottleneck.rank,
  }));
}

function mapOverallScore(
  assessment: NonNullable<Awaited<ReturnType<typeof findAssessmentForResult>>>,
  structuredDiagnosis?: StructuredDiagnosis,
): OverallScoreResult {
  if (assessment.overallScore) {
    return {
      rawScore: assessment.overallScore.rawScore,
      maxScore: assessment.overallScore.maxScore,
      percentage: assessment.overallScore.percentage,
      healthLevel: assessment.overallScore.healthLevel as HealthLevel,
    };
  }

  const percentage = structuredDiagnosis
    ? structuredDiagnosis.healthWeighted * 100
    : 0;

  return {
    rawScore: 0,
    maxScore: 0,
    percentage,
    healthLevel: "weak",
  };
}

function healthLevelToDomainLevel(healthLevel: string): DomainLevel {
  switch (healthLevel) {
    case "critical":
      return "critical";
    case "weak":
      return "weak";
    case "medium":
      return "medium";
    case "healthy":
    case "advanced":
      return "healthy";
    default:
      return "medium";
  }
}

function resolveLegacySurvivalStatus(
  structuredReport: StructuredReport | null,
): SurvivalStatus {
  return structuredReport?.diagnosisSummary?.survivalStatus ?? "GREEN";
}

function resolveLegacyTone(status: SurvivalStatus): ReportSpec["survivalBanner"]["tone"] {
  switch (status) {
    case "RED":
      return "urgent";
    case "AMBER":
      return "serious";
    default:
      return "optimization";
  }
}

function buildLegacyRadarReportSpec(
  assessment: NonNullable<Awaited<ReturnType<typeof findAssessmentForResult>>>,
  structuredReport: StructuredReport | null,
): ReportSpec {
  const healthDisplay = Math.round(assessment.overallScore?.percentage ?? 0);
  const survivalStatus = resolveLegacySurvivalStatus(structuredReport);

  const radarDomains = assessment.domainScores
    .slice()
    .sort((a, b) => a.domain.displayOrder - b.domain.displayOrder)
    .map((score) => {
      const engineId =
        SLUG_TO_ENGINE_ID[score.domain.slug] ?? score.domain.displayOrder;
      return {
        engineId,
        domainSlug: score.domain.slug,
        domainName: score.domain.name,
        percentage: Math.round(score.percentage),
        level: healthLevelToDomainLevel(score.healthLevel),
      };
    });

  const domainBreakdown: ReportSpec["domainBreakdown"] = radarDomains.map(
    (domain) => ({
      engineId: domain.engineId,
      domainSlug: domain.domainSlug,
      domainName: domain.domainName,
      rawScore: 0,
      percentage: domain.percentage,
      level: domain.level,
      tier: "foundation" as VitalityTier,
      family: "",
      incomplete: false,
      expanded: domain.level === "weak" || domain.level === "critical",
      symptoms: "",
      evidence: [],
      interpretation: "",
      qualitativeCost: "",
      fixLock: {
        locked: true,
        label: "",
        destination: "consultation",
      },
    }),
  );

  return {
    survivalBanner: {
      status: survivalStatus,
      tone: resolveLegacyTone(survivalStatus),
    },
    healthDisplay,
    charts: [
      {
        kind: "health-gauge",
        data: {
          percentage: healthDisplay,
          survivalStatus,
          healthWeighted: healthDisplay / 100,
        },
      },
      {
        kind: "radar",
        data: { domains: radarDomains },
      },
    ],
    quickWinTeaser: null,
    issues: [],
    domainBreakdown,
    valueAtStake: null,
    quickWin: null,
    lockedPlan: { titles: [] },
    ctas: [
      {
        moment: "urgency",
        headline: "برای بهبود فروش اقدام کنید",
        destination: "consultation",
        personalization: { structuralRoots: [] },
      },
      {
        moment: "trust",
        headline: "مشاوره رایگان دریافت کنید",
        destination: "consultation",
        personalization: { structuralRoots: [] },
      },
    ],
    capacityMode: env.capacityMode,
    confidenceNote: {
      level: "medium",
      instrumentFirst: false,
    },
    expertView: {
      leadScore: "warm",
      suggestedOffer: "consultation",
      appetizerActions: [],
      disclosureGuide: "",
    },
  };
}

export async function recomposeReportSpec(
  assessmentId: string,
  structuredDiagnosis: StructuredDiagnosis,
  modelVersionId: string,
): Promise<ReportSpec | null> {
  const assessment = await findAssessmentForResult(assessmentId);
  if (!assessment) return null;

  const [domains, layers, answers] = await Promise.all([
    loadDomainsWithQuestions(modelVersionId),
    loadLayers(modelVersionId),
    getAnswersWithDetails(assessmentId),
  ]);

  const domainNames = new Map(domains.map((domain) => [domain.slug, domain.name]));
  const layerNames = new Map(layers.map((layer) => [layer.slug, layer.name]));
  const valueAtStakeInput = toValueAtStakeInput(assessment);
  const valueAtStake = valueAtStakeInput
    ? computeValueAtStake(structuredDiagnosis, valueAtStakeInput)
    : null;

  return buildReportSpec({
    overallScore: mapOverallScore(assessment, structuredDiagnosis),
    domainScores: mapDomainScores(assessment),
    layerScores: mapLayerScores(assessment, layers),
    bottlenecks: mapBottlenecks(assessment),
    domainNames,
    layerNames,
    structuredDiagnosis,
    answers: toComposerAnswers(answers),
    valueAtStake,
    capacityMode: env.capacityMode,
  });
}

export async function ensureReportSpec(reportId: string): Promise<ReportSpec> {
  const report = await findReportById(reportId);

  if (!report) {
    throw new AppError("report_not_found", "Report not found", 404, {
      reportId,
    });
  }

  const existing = parseReportSpec(report.reportSpec);
  if (hasRadarChart(existing)) {
    return existing!;
  }

  const assessment = await findAssessmentForResult(report.assessmentSessionId);

  if (!assessment?.report) {
    throw new AppError(
      "report_not_found",
      "Report not found for this assessment",
      404,
      { reportId },
    );
  }

  const structuredDiagnosis = assessment.structuredDiagnosis as
    | StructuredDiagnosis
    | null
    | undefined;

  let reportSpec: ReportSpec | null = null;

  if (structuredDiagnosis) {
    reportSpec = await recomposeReportSpec(
      assessment.id,
      structuredDiagnosis,
      assessment.modelVersionId,
    );
  } else if (assessment.domainScores.length > 0) {
    const structuredReport = report.structuredReport as unknown as StructuredReport;
    reportSpec = buildLegacyRadarReportSpec(assessment, structuredReport);
  }

  if (!reportSpec || !hasRadarChart(reportSpec)) {
    throw new AppError(
      "report_spec_unavailable",
      "Report spec could not be rebuilt for this assessment",
      404,
      { reportId },
    );
  }

  await updateReportSpec(reportId, reportSpec);
  return reportSpec;
}
