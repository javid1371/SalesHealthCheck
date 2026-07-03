import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { generateResultToken } from "@/lib/token";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { runDiagnosis } from "@/modules/diagnosis/diagnosis.engine";
import { resolveDiagnosisEngineVersion } from "@/modules/diagnosis/diagnosis.helpers";
import {
  loadActiveModelVersion,
  loadQuestionsForAssessment,
  validateOptionBelongsToQuestion,
  validateQuestionBelongsToModelVersion,
} from "@/modules/question-bank/question-bank.service";
import {
  countActiveQuestions,
  loadDomainsWithQuestions,
  loadLayers,
  toDiagnosisDomainInputs,
  toDiagnosisLayerInputs,
  toScoringDomainInputs,
  toScoringLayerInputs,
} from "@/modules/question-bank/question-bank.repository";
import { buildFullReport, type ComposerAnswerInput } from "@/modules/report/report.builder";
import {
  ensureReportSpec,
  parseReportSpec,
  recomposeReportSpec,
} from "@/modules/report/report-spec.service";
import { computeValueAtStake } from "@/modules/report/value-at-stake.engine";
import {
  calculateDomainScores,
  calculateLayerScores,
  calculateOverallScore,
  prepareSpiderChartData,
} from "@/modules/scoring/scoring.engine";
import type { ScoringAnswerInput } from "@/modules/scoring/scoring.types";
import type { StructuredReport } from "@/types/report";
import { toPublicStructuredReport } from "@/types/report";
import type { ReportSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeInput } from "@/types/value-at-stake";
import {
  buildResultUrl,
  validateBusinessInfoRequest,
  validateBusinessMetricsRequest,
  validateFinishRequest,
  validateSaveAnswersRequest,
  validateStartRequest,
} from "./assessment.validators";
import {
  countAnswersForAssessment,
  createAssessmentSession,
  createOrganization,
  findAssessmentById,
  findAssessmentForResult,
  findReportById,
  findUserById,
  updateUserProfile,
  getAnswersWithDetails,
  persistAssessmentResults,
  updateAssessmentBusinessMetrics,
  updateAssessmentStatus,
  updateOrganization,
  updateReportSpec,
  upsertAnswer,
} from "./assessment.repository";
import type {
  AssessmentAnswersResponse,
  AssessmentProgressResponse,
  AssessmentResultResponse,
  AssessmentStatusResponse,
  ExpertViewAccessInput,
  ExpertViewResponse,
  FinishAssessmentInput,
  FinishAssessmentResponse,
  ReportResponse,
  ResultAccessInput,
  SaveAnswersInput,
  StartAssessmentContext,
  StartAssessmentInput,
  StartAssessmentResponse,
  UpdateBusinessInfoInput,
  UpdateBusinessMetricsInput,
  UpdateBusinessMetricsResponse,
} from "./assessment.types";

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

function assertAssessmentNotCompleted(status: string) {
  if (status === "completed") {
    throw new AppError(
      "assessment_already_completed",
      "Assessment has already been completed",
      409,
    );
  }
}

function assertAssessmentCompleted(status: string) {
  if (status !== "completed") {
    throw new AppError(
      "assessment_not_completed",
      "Assessment is not completed yet",
      409,
    );
  }
}

export function assertResultAccess(params: {
  assessment: { userId: string; resultToken: string };
} & ResultAccessInput): void {
  const { assessment, token, userSession, adminSession, salesExpertSession } =
    params;

  if (adminSession || salesExpertSession) {
    return;
  }

  if (token && token === assessment.resultToken) {
    return;
  }

  if (userSession && userSession.userId === assessment.userId) {
    return;
  }

  throw new AppError(
    "assessment_access_denied",
    "Invalid or missing access token",
    403,
  );
}

async function buildProgress(
  assessmentId: string,
  modelVersionId: string,
): Promise<AssessmentProgressResponse> {
  const [answeredQuestions, totalQuestions] = await Promise.all([
    countAnswersForAssessment(assessmentId),
    countActiveQuestions(modelVersionId),
  ]);

  const percentage =
    totalQuestions === 0
      ? 0
      : Math.round((answeredQuestions / totalQuestions) * 100);

  return {
    answeredQuestions,
    totalQuestions,
    percentage,
  };
}

async function getAssessmentOrThrow(assessmentId: string) {
  const assessment = await findAssessmentById(assessmentId);

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "Assessment not found",
      404,
      { assessmentId },
    );
  }

  return assessment;
}

export async function startAssessment(
  input: StartAssessmentInput,
  context: StartAssessmentContext,
): Promise<StartAssessmentResponse> {
  const validated = validateStartRequest(input);

  try {
    const modelVersion = await loadActiveModelVersion();

    const user = await findUserById(context.userId);
    if (!user) {
      throw new AppError(
        "UNAUTHORIZED",
        "برای شروع ارزیابی ابتدا وارد شوید.",
        401,
      );
    }

    await updateUserProfile(user.id, validated.user);

    const organization = await createOrganization({
      userId: user.id,
      ...validated.organization,
    });

    const resultToken = generateResultToken();

    const session = await createAssessmentSession({
      userId: user.id,
      organizationId: organization.id,
      modelVersionId: modelVersion.id,
      resultToken,
    });

    const { hookAssessmentStarted } = await import("@/modules/sms-funnel/hooks");
    hookAssessmentStarted(user.id, session.id);

    return {
      assessmentId: session.id,
      status: session.status,
      resultToken,
      modelVersion: {
        id: modelVersion.id,
        versionNumber: modelVersion.versionNumber,
      },
      nextStep: "questions",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "assessment_start_failed",
      "Failed to start assessment",
      500,
    );
  }
}

export async function getAssessmentStatus(
  assessmentId: string,
): Promise<AssessmentStatusResponse> {
  const assessment = await getAssessmentOrThrow(assessmentId);
  const progress = await buildProgress(assessmentId, assessment.modelVersionId);

  return {
    assessmentId: assessment.id,
    status: assessment.status,
    progress,
    organization: {
      businessName: assessment.organization.businessName,
      industry: assessment.organization.industry,
      teamSize: assessment.organization.teamSize,
      salesModel: assessment.organization.salesModel,
    },
    modelVersion: {
      id: assessment.modelVersion.id,
      versionNumber: assessment.modelVersion.versionNumber,
    },
  };
}

export async function getAssessmentQuestions(assessmentId: string) {
  const assessment = await getAssessmentOrThrow(assessmentId);
  assertAssessmentNotCompleted(assessment.status);

  return loadQuestionsForAssessment(assessmentId, assessment.modelVersionId);
}

export async function getAssessmentAnswers(
  assessmentId: string,
): Promise<AssessmentAnswersResponse> {
  const assessment = await getAssessmentOrThrow(assessmentId);
  assertAssessmentNotCompleted(assessment.status);

  const answers = await getAnswersWithDetails(assessmentId);

  return {
    assessmentId,
    answers: answers.map((answer) => ({
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
    })),
  };
}

export async function saveAnswers(
  assessmentId: string,
  input: SaveAnswersInput,
) {
  const validated = validateSaveAnswersRequest(input);
  const assessment = await getAssessmentOrThrow(assessmentId);
  assertAssessmentNotCompleted(assessment.status);

  for (const answer of validated.answers) {
    await validateQuestionBelongsToModelVersion(
      answer.questionId,
      assessment.modelVersionId,
    );

    const option = await validateOptionBelongsToQuestion(
      answer.selectedOptionId,
      answer.questionId,
    );

    await upsertAnswer({
      assessmentSessionId: assessmentId,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      scoreSnapshot: option.score,
    });
  }

  if (assessment.status === "started") {
    await updateAssessmentStatus(assessmentId, "in_progress");
    const { hookAssessmentInProgress } = await import(
      "@/modules/sms-funnel/hooks"
    );
    hookAssessmentInProgress(assessment.userId, assessmentId);
  }

  const progress = await buildProgress(assessmentId, assessment.modelVersionId);

  return {
    assessmentId,
    savedAnswers: validated.answers.length,
    progress,
  };
}

export async function updateBusinessInfo(
  assessmentId: string,
  input: UpdateBusinessInfoInput,
) {
  const validated = validateBusinessInfoRequest(input);
  const assessment = await getAssessmentOrThrow(assessmentId);
  assertAssessmentNotCompleted(assessment.status);

  const organization = await updateOrganization(assessment.organizationId, {
    businessName: validated.businessName,
    industry: validated.industry,
    teamSize: validated.teamSize,
    salesModel: validated.salesModel,
  });

  return {
    assessmentId,
    organization: {
      businessName: organization.businessName,
      industry: organization.industry,
      teamSize: organization.teamSize,
      salesModel: organization.salesModel,
    },
  };
}

async function validateAllQuestionsAnswered(
  assessmentId: string,
  modelVersionId: string,
) {
  const [domains, answerCount, totalQuestions] = await Promise.all([
    loadDomainsWithQuestions(modelVersionId),
    countAnswersForAssessment(assessmentId),
    countActiveQuestions(modelVersionId),
  ]);

  if (answerCount < totalQuestions) {
    const unansweredDomains = domains
      .map((domain) => {
        const domainQuestionIds = domain.questions.map((q) => q.id);
        return {
          domainName: domain.name,
          total: domainQuestionIds.length,
        };
      })
      .filter((d) => d.total > 0);

    throw new AppError(
      "assessment_not_complete",
      "Not all required questions have been answered",
      400,
      {
        answeredQuestions: answerCount,
        totalQuestions,
        domains: unansweredDomains,
      },
    );
  }
}

function toScoringAnswers(
  answers: Awaited<ReturnType<typeof getAnswersWithDetails>>,
): ScoringAnswerInput[] {
  return answers.map((answer) => ({
    questionId: answer.questionId,
    domainId: answer.question.domainId,
    domainSlug: answer.question.domain.slug,
    score: answer.scoreSnapshot,
  }));
}

function buildFinishResponse(
  assessmentId: string,
  resultToken: string,
  reportId: string,
): FinishAssessmentResponse {
  return {
    assessmentId,
    status: "completed",
    reportId,
    resultUrl: buildResultUrl(assessmentId, resultToken),
  };
}

async function tryReturnCompletedAssessment(
  assessmentId: string,
): Promise<FinishAssessmentResponse | null> {
  const assessment = await findAssessmentById(assessmentId);

  if (assessment?.report) {
    return buildFinishResponse(
      assessmentId,
      assessment.resultToken,
      assessment.report.id,
    );
  }

  return null;
}

export async function finishAssessment(
  assessmentId: string,
  input: FinishAssessmentInput = {},
): Promise<FinishAssessmentResponse> {
  validateFinishRequest(input);

  const assessment = await getAssessmentOrThrow(assessmentId);

  if (assessment.report) {
    return buildFinishResponse(
      assessmentId,
      assessment.resultToken,
      assessment.report.id,
    );
  }

  assertAssessmentNotCompleted(assessment.status);

  await validateAllQuestionsAnswered(assessmentId, assessment.modelVersionId);

  try {
    const [domains, layers, answers] = await Promise.all([
      loadDomainsWithQuestions(assessment.modelVersionId),
      loadLayers(assessment.modelVersionId),
      getAnswersWithDetails(assessmentId),
    ]);

    const scoringDomains = toScoringDomainInputs(domains);
    const scoringLayers = toScoringLayerInputs(layers);
    const scoringAnswers = toScoringAnswers(answers);

    const domainScores = calculateDomainScores(scoringAnswers, scoringDomains);
    const layerScores = calculateLayerScores(
      domainScores,
      scoringLayers,
      scoringDomains,
    );
    const overallScore = calculateOverallScore(scoringAnswers);

    const diagnosisDomains = toDiagnosisDomainInputs(domains);
    const diagnosisLayers = toDiagnosisLayerInputs(layers);

    const diagnosisAnswers = answers.map((answer) => ({
      displayOrder: answer.question.domain.displayOrder,
      domainSlug: answer.question.domain.slug,
      questionNumber: answer.question.displayOrder,
      score: answer.scoreSnapshot,
    }));

    const diagnosisResult = runDiagnosis({
      engineVersion: resolveDiagnosisEngineVersion(
        assessment.modelVersion.diagnosisEngineVersion,
      ),
      domainScores,
      layerScores,
      domains: diagnosisDomains,
      layers: diagnosisLayers,
      answers: diagnosisAnswers,
    });

    const { bottlenecks, diagnoses, structuredDiagnosis } = diagnosisResult;

    const domainNames = new Map(domains.map((d) => [d.slug, d.name]));
    const layerNames = new Map(layers.map((l) => [l.slug, l.name]));
    const composerAnswers = toComposerAnswers(answers);

    const valueAtStakeInput = toValueAtStakeInput(assessment);
    const valueAtStake =
      structuredDiagnosis && valueAtStakeInput
        ? computeValueAtStake(structuredDiagnosis, valueAtStakeInput)
        : null;

    const { structuredReport, reportSpec } = buildFullReport({
      overallScore,
      domainScores,
      layerScores,
      bottlenecks,
      domainNames,
      layerNames,
      structuredDiagnosis,
      answers: composerAnswers,
      valueAtStake,
      capacityMode: env.capacityMode,
    });

    const { report } = await persistAssessmentResults({
      assessmentId,
      domainScores,
      layerScores,
      overallScore,
      bottlenecks,
      diagnoses,
      structuredReport,
      structuredDiagnosis: structuredDiagnosis ?? null,
      reportSpec: reportSpec ?? null,
    });

    const { hookAssessmentCompleted } = await import("@/modules/sms-funnel/hooks");
    hookAssessmentCompleted({
      userId: assessment.userId,
      assessmentSessionId: assessmentId,
      overallScorePercentage: overallScore.percentage,
    });

    return buildFinishResponse(assessmentId, assessment.resultToken, report.id);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const completed = await tryReturnCompletedAssessment(assessmentId);
      if (completed) return completed;
    }

    const completed = await tryReturnCompletedAssessment(assessmentId);
    if (completed) return completed;

    console.error("finishAssessment failed:", error);
    throw new AppError(
      "report_generation_failed",
      "Failed to generate assessment report",
      500,
    );
  }
}

export async function updateBusinessMetrics(
  assessmentId: string,
  input: UpdateBusinessMetricsInput,
): Promise<UpdateBusinessMetricsResponse> {
  const validated = validateBusinessMetricsRequest(input);
  const assessment = await getAssessmentOrThrow(assessmentId);
  assertAssessmentCompleted(assessment.status);

  if (!assessment.report) {
    throw new AppError(
      "report_not_found",
      "Report not found for this assessment",
      404,
    );
  }

  await updateAssessmentBusinessMetrics(assessmentId, validated);

  const structuredDiagnosis = assessment.structuredDiagnosis as
    | StructuredDiagnosis
    | null
    | undefined;

  let reportSpec: ReportSpec | null = null;
  if (structuredDiagnosis) {
    reportSpec = await recomposeReportSpec(
      assessmentId,
      structuredDiagnosis,
      assessment.modelVersionId,
    );
    await updateReportSpec(assessment.report.id, reportSpec);
  }

  return {
    assessmentId,
    report: {
      id: assessment.report.id,
      reportSpec,
    },
  };
}

export async function getAssessmentResult(
  assessmentId: string,
  access: ResultAccessInput = {},
): Promise<AssessmentResultResponse> {
  const assessment = await findAssessmentForResult(assessmentId);

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "Assessment not found",
      404,
      { assessmentId },
    );
  }

  assertResultAccess({
    assessment: {
      userId: assessment.userId,
      resultToken: assessment.resultToken,
    },
    ...access,
  });
  assertAssessmentCompleted(assessment.status);

  if (!assessment.report || !assessment.overallScore) {
    throw new AppError(
      "report_not_found",
      "Report not found for this assessment",
      404,
    );
  }

  const structuredReport = assessment.report
    .structuredReport as unknown as StructuredReport;
  const publicReport = toPublicStructuredReport(structuredReport);

  const domains = await loadDomainsWithQuestions(assessment.modelVersionId);
  const scoringDomains = toScoringDomainInputs(domains);

  const domainScoreResults = assessment.domainScores.map((score) => ({
    domainId: score.domainId,
    domainSlug: score.domain.slug,
    rawScore: score.rawScore,
    maxScore: score.maxScore,
    percentage: score.percentage,
    healthLevel: score.healthLevel,
  }));

  const spiderChartData = prepareSpiderChartData(
    domainScoreResults,
    scoringDomains,
  );

  return {
    assessmentId: assessment.id,
    status: assessment.status,
    overallScore: {
      rawScore: assessment.overallScore.rawScore,
      maxScore: assessment.overallScore.maxScore,
      percentage: assessment.overallScore.percentage,
      healthLevel: assessment.overallScore.healthLevel,
    },
    domainScores: assessment.domainScores.map((score) => ({
      domainId: score.domainId,
      name: score.domain.name,
      percentage: score.percentage,
      healthLevel: score.healthLevel,
      layer: score.domain.layer.name,
    })),
    layerScores: assessment.layerScores.map((score) => ({
      layerId: score.layerId,
      name: score.layer.name,
      percentage: score.percentage,
      healthLevel: score.healthLevel,
    })),
    bottlenecks: assessment.bottlenecks.map((bottleneck) => ({
      rank: bottleneck.rank,
      domainId: bottleneck.domainId,
      domainName: bottleneck.domain.name,
      weaknessScore: bottleneck.weaknessScore,
      domainWeight: bottleneck.domainWeight,
      priorityScore: bottleneck.priorityScore,
    })),
    diagnoses: assessment.diagnoses.map((diagnosis) => ({
      diagnosisKey: diagnosis.diagnosisKey,
      title: diagnosis.title,
      severity: diagnosis.severity,
      priority: diagnosis.priority,
    })),
    report: {
      id: assessment.report.id,
      reportStatus: assessment.report.reportStatus,
      overallSummary: publicReport.overallSummary,
      layerSummaries: publicReport.layerSummaries,
      bottleneckSummaries: publicReport.bottleneckSummaries,
      domainResults: publicReport.domainResults,
      correctiveActions:
        publicReport.correctiveActions ??
        legacyCorrectiveActions(publicReport.actionPlans),
      diagnosisSummary: publicReport.diagnosisSummary,
      reportSpec: parseReportSpec(assessment.report.reportSpec),
    },
    diagnosisEngineVersion: assessment.modelVersion.diagnosisEngineVersion,
    spiderChartData,
  };
}

export async function getReport(
  reportId: string,
  access: ResultAccessInput = {},
): Promise<ReportResponse> {
  const report = await findReportById(reportId);

  if (!report) {
    throw new AppError(
      "report_not_found",
      "Report not found",
      404,
      { reportId },
    );
  }

  assertResultAccess({
    assessment: {
      userId: report.assessmentSession.userId,
      resultToken: report.assessmentSession.resultToken,
    },
    ...access,
  });

  const session = report.assessmentSession;

  return {
    reportId: report.id,
    assessmentId: report.assessmentSessionId,
    reportStatus: report.reportStatus,
    businessName: session.organization.businessName,
    overallScore: session.overallScore
      ? {
          rawScore: session.overallScore.rawScore,
          maxScore: session.overallScore.maxScore,
          percentage: session.overallScore.percentage,
          healthLevel: session.overallScore.healthLevel,
        }
      : null,
    bottlenecks: session.bottlenecks.map((bottleneck) => ({
      rank: bottleneck.rank,
      domainId: bottleneck.domainId,
      domainName: bottleneck.domain.name,
      weaknessScore: bottleneck.weaknessScore,
      domainWeight: bottleneck.domainWeight,
      priorityScore: bottleneck.priorityScore,
    })),
    diagnoses: session.diagnoses.map((diagnosis) => ({
      diagnosisKey: diagnosis.diagnosisKey,
      title: diagnosis.title,
      description: diagnosis.description,
      severity: diagnosis.severity,
      priority: diagnosis.priority,
    })),
    structuredReport: toPublicStructuredReport(
      report.structuredReport as unknown as StructuredReport,
    ),
    reportSpec: await resolveReportSpec(reportId, report.reportSpec),
    aiGeneratedText: report.aiGeneratedText,
    createdAt: report.createdAt.toISOString(),
  };
}

async function resolveReportSpec(
  reportId: string,
  rawReportSpec: unknown,
): Promise<ReportSpec | null> {
  let reportSpec = parseReportSpec(rawReportSpec);
  if (!reportSpec?.charts?.some((chart) => chart.kind === "radar")) {
    reportSpec = await ensureReportSpec(reportId);
  }
  return reportSpec;
}

export async function getExpertView(
  assessmentId: string,
  access: ExpertViewAccessInput = {},
): Promise<ExpertViewResponse> {
  if (!access.adminSession && !access.salesExpertSession) {
    const expected = env.expertViewToken;
    if (expected) {
      if (access.adminToken !== expected) {
        throw new AppError(
          "UNAUTHORIZED",
          "Invalid admin token",
          401,
        );
      }
    } else if (env.nodeEnv === "production") {
      throw new AppError(
        "UNAUTHORIZED",
        "Expert view not configured",
        401,
      );
    }
  }

  const assessment = await findAssessmentForResult(assessmentId);

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "Assessment not found",
      404,
      { assessmentId },
    );
  }

  assertAssessmentCompleted(assessment.status);

  if (!assessment.report) {
    throw new AppError(
      "report_not_found",
      "Report not found for this assessment",
      404,
    );
  }

  const reportSpec = parseReportSpec(assessment.report.reportSpec);
  if (!reportSpec?.expertView) {
    throw new AppError(
      "NOT_FOUND",
      "Expert view not available for this report",
      404,
    );
  }

  return {
    assessmentId,
    businessName: assessment.organization.businessName,
    expertView: reportSpec.expertView,
  };
}

function legacyCorrectiveActions(
  actionPlans: StructuredReport["actionPlans"],
): StructuredReport["correctiveActions"] {
  if (!actionPlans) return [];

  const actions: StructuredReport["correctiveActions"] = [];

  for (const action of actionPlans.sevenDay) {
    actions.push({
      domainSlug: "",
      domainName: action.title,
      description: action.description,
    });
  }

  for (const action of actionPlans.thirtyDay) {
    actions.push({
      domainSlug: "",
      domainName: action.title,
      description: action.description,
    });
  }

  return actions;
}
