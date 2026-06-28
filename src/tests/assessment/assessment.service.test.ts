import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/modules/assessment/assessment.repository", () => ({
  findUserByEmailOrPhone: vi.fn(),
  createUser: vi.fn(),
  createOrganization: vi.fn(),
  createAssessmentSession: vi.fn(),
  findAssessmentById: vi.fn(),
  findAssessmentForResult: vi.fn(),
  countAnswersForAssessment: vi.fn(),
  upsertAnswer: vi.fn(),
  updateAssessmentStatus: vi.fn(),
  updateOrganization: vi.fn(),
  updateAssessmentBusinessMetrics: vi.fn(),
  updateReportSpec: vi.fn(),
  getAnswersWithDetails: vi.fn(),
  persistAssessmentResults: vi.fn(),
  findReportById: vi.fn(),
}));

vi.mock("@/modules/question-bank/question-bank.service", () => ({
  loadActiveModelVersion: vi.fn(),
  loadQuestionsForAssessment: vi.fn(),
  validateQuestionBelongsToModelVersion: vi.fn(),
  validateOptionBelongsToQuestion: vi.fn(),
}));

vi.mock("@/modules/question-bank/question-bank.repository", () => ({
  countActiveQuestions: vi.fn(),
  loadDomainsWithQuestions: vi.fn(),
  loadLayers: vi.fn(),
  toScoringDomainInputs: vi.fn(),
  toScoringLayerInputs: vi.fn(),
  toDiagnosisDomainInputs: vi.fn(),
  toDiagnosisLayerInputs: vi.fn(),
}));

import {
  countAnswersForAssessment,
  createAssessmentSession,
  createOrganization,
  createUser,
  findAssessmentById,
  getAnswersWithDetails,
  persistAssessmentResults,
  updateAssessmentBusinessMetrics,
  updateReportSpec,
  upsertAnswer,
} from "@/modules/assessment/assessment.repository";
import {
  countActiveQuestions,
  loadDomainsWithQuestions,
  loadLayers,
  toDiagnosisDomainInputs,
  toDiagnosisLayerInputs,
  toScoringDomainInputs,
  toScoringLayerInputs,
} from "@/modules/question-bank/question-bank.repository";
import {
  validateOptionBelongsToQuestion,
  validateQuestionBelongsToModelVersion,
} from "@/modules/question-bank/question-bank.service";
import {
  finishAssessment,
  getAssessmentAnswers,
  saveAnswers,
  updateBusinessMetrics,
} from "@/modules/assessment/assessment.service";
import { validateBusinessMetricsRequest } from "@/modules/assessment/assessment.validators";
import { runDiagnosisV2FromRawScores } from "@/modules/diagnosis/v2/run-diagnosis-v2";

const mockAssessment = {
  id: "assessment-1",
  userId: "user-1",
  organizationId: "org-1",
  modelVersionId: "model-1",
  status: "in_progress" as const,
  resultToken: "token-abc",
  startedAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: "org-1",
    businessName: "Test Co",
    industry: "tech",
    teamSize: "5-10",
    salesModel: "online" as const,
  },
  modelVersion: {
    id: "model-1",
    versionNumber: "1.0.0",
    diagnosisEngineVersion: "v1",
  },
  report: null,
  answers: [],
};

const mockDomains = [
  {
    id: "domain-1",
    slug: "persona",
    name: "Persona",
    weight: 1.4,
    layerId: "layer-1",
    displayOrder: 1,
    layer: { id: "layer-1", slug: "layer-1", name: "Layer 1" },
    questions: [
      {
        id: "q1",
        domainId: "domain-1",
        text: "Q1",
        options: [{ id: "o1", score: 3 }],
      },
      {
        id: "q2",
        domainId: "domain-1",
        text: "Q2",
        options: [{ id: "o2", score: 2 }],
      },
    ],
  },
];

const mockLayers = [
  { id: "layer-1", slug: "layer-1", name: "Layer 1", displayOrder: 1 },
];

const mockAnswers = [
  {
    questionId: "q1",
    scoreSnapshot: 3,
    question: {
      domainId: "domain-1",
      displayOrder: 1,
      domain: { slug: "persona", displayOrder: 1 },
    },
  },
  {
    questionId: "q2",
    scoreSnapshot: 2,
    question: {
      domainId: "domain-1",
      displayOrder: 2,
      domain: { slug: "persona", displayOrder: 1 },
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAssessmentAnswers", () => {
  it("returns saved answers for in-progress assessment", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue(mockAssessment as never);
    vi.mocked(getAnswersWithDetails).mockResolvedValue([
      {
        questionId: "q1",
        selectedOptionId: "o1",
        scoreSnapshot: 3,
        question: {
          domainId: "domain-1",
          displayOrder: 1,
          domain: { slug: "persona", displayOrder: 1 },
        },
      },
      {
        questionId: "q2",
        selectedOptionId: "o2",
        scoreSnapshot: 2,
        question: {
          domainId: "domain-1",
          displayOrder: 2,
          domain: { slug: "persona", displayOrder: 1 },
        },
      },
    ] as never);

    const result = await getAssessmentAnswers("assessment-1");

    expect(result).toEqual({
      assessmentId: "assessment-1",
      answers: [
        { questionId: "q1", selectedOptionId: "o1" },
        { questionId: "q2", selectedOptionId: "o2" },
      ],
    });
  });

  it("rejects completed assessment with 409", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue({
      ...mockAssessment,
      status: "completed",
      report: { id: "report-1" },
    } as never);

    await expect(getAssessmentAnswers("assessment-1")).rejects.toMatchObject({
      code: "assessment_already_completed",
      status: 409,
    });

    expect(getAnswersWithDetails).not.toHaveBeenCalled();
  });
});

describe("saveAnswers", () => {
  it("rejects invalid option with 409", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue(mockAssessment as never);
    vi.mocked(validateQuestionBelongsToModelVersion).mockResolvedValue({
      id: "q1",
      modelVersionId: "model-1",
    } as never);
    vi.mocked(validateOptionBelongsToQuestion).mockRejectedValue(
      new AppError(
        "option_does_not_belong_to_question",
        "Option does not belong to the specified question",
        409,
      ),
    );

    await expect(
      saveAnswers("assessment-1", {
        answers: [{ questionId: "q1", selectedOptionId: "wrong-option" }],
      }),
    ).rejects.toMatchObject({
      code: "option_does_not_belong_to_question",
      status: 409,
    });

    expect(upsertAnswer).not.toHaveBeenCalled();
  });
});

describe("finishAssessment", () => {
  it("returns existing report when assessment is already completed (idempotent)", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue({
      ...mockAssessment,
      status: "completed",
      report: { id: "report-existing" },
    } as never);

    const result = await finishAssessment("assessment-1");

    expect(result).toEqual({
      assessmentId: "assessment-1",
      status: "completed",
      reportId: "report-existing",
      resultUrl: "/assessment/assessment-1/result?token=token-abc",
    });
    expect(persistAssessmentResults).not.toHaveBeenCalled();
  });

  it("returns existing report after concurrent finish conflict (P2002)", async () => {
    vi.mocked(findAssessmentById)
      .mockResolvedValueOnce(mockAssessment as never)
      .mockResolvedValueOnce({
        ...mockAssessment,
        status: "completed",
        report: { id: "report-existing" },
      } as never);
    vi.mocked(loadDomainsWithQuestions).mockResolvedValue(mockDomains as never);
    vi.mocked(loadLayers).mockResolvedValue(mockLayers as never);
    vi.mocked(countAnswersForAssessment).mockResolvedValue(2);
    vi.mocked(countActiveQuestions).mockResolvedValue(2);
    vi.mocked(getAnswersWithDetails).mockResolvedValue(mockAnswers as never);
    vi.mocked(toScoringDomainInputs).mockReturnValue([
      {
        id: "domain-1",
        slug: "persona",
        name: "Persona",
        layerId: "layer-1",
        layerSlug: "layer-1",
        displayOrder: 1,
      },
    ]);
    vi.mocked(toScoringLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1", displayOrder: 1 },
    ]);
    vi.mocked(toDiagnosisDomainInputs).mockReturnValue([
      { id: "domain-1", slug: "persona", name: "Persona", weight: 1.4 },
    ]);
    vi.mocked(toDiagnosisLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1" },
    ]);
    vi.mocked(persistAssessmentResults).mockRejectedValue(
      Object.assign(new Error("Unique constraint"), {
        code: "P2002",
        name: "PrismaClientKnownRequestError",
      }),
    );

    const result = await finishAssessment("assessment-1");

    expect(result.reportId).toBe("report-existing");
  });

  it("rejects incomplete assessment with 400", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue(mockAssessment as never);
    vi.mocked(loadDomainsWithQuestions).mockResolvedValue(mockDomains as never);
    vi.mocked(countAnswersForAssessment).mockResolvedValue(1);
    vi.mocked(countActiveQuestions).mockResolvedValue(2);

    await expect(finishAssessment("assessment-1")).rejects.toMatchObject({
      code: "assessment_not_complete",
      status: 400,
    });

    expect(persistAssessmentResults).not.toHaveBeenCalled();
  });

  it("completes assessment happy path with scoring and report persistence", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue(mockAssessment as never);
    vi.mocked(loadDomainsWithQuestions).mockResolvedValue(mockDomains as never);
    vi.mocked(loadLayers).mockResolvedValue(mockLayers as never);
    vi.mocked(countAnswersForAssessment).mockResolvedValue(2);
    vi.mocked(countActiveQuestions).mockResolvedValue(2);
    vi.mocked(getAnswersWithDetails).mockResolvedValue(mockAnswers as never);
    vi.mocked(toScoringDomainInputs).mockReturnValue([
      {
        id: "domain-1",
        slug: "persona",
        name: "Persona",
        layerId: "layer-1",
        layerSlug: "layer-1",
        displayOrder: 1,
      },
    ]);
    vi.mocked(toScoringLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1", displayOrder: 1 },
    ]);
    vi.mocked(toDiagnosisDomainInputs).mockReturnValue([
      { id: "domain-1", slug: "persona", name: "Persona", weight: 1.4 },
    ]);
    vi.mocked(toDiagnosisLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1" },
    ]);
    vi.mocked(persistAssessmentResults).mockResolvedValue({
      report: { id: "report-new" },
      bottlenecks: [],
      diagnoses: [],
    } as never);

    const result = await finishAssessment("assessment-1");

    expect(result).toEqual({
      assessmentId: "assessment-1",
      status: "completed",
      reportId: "report-new",
      resultUrl: "/assessment/assessment-1/result?token=token-abc",
    });

    expect(persistAssessmentResults).toHaveBeenCalledOnce();
    const persisted = vi.mocked(persistAssessmentResults).mock.calls[0][0];
    expect(persisted.assessmentId).toBe("assessment-1");
    expect(persisted.overallScore.rawScore).toBe(5);
    expect(persisted.overallScore.maxScore).toBe(6);
    expect(persisted.bottlenecks).toHaveLength(1);
    expect(persisted.structuredReport.overallSummary).toBeTruthy();
    expect(persisted.reportSpec).toBeNull();
  });

  it("persists reportSpec when diagnosis v2 produces structuredDiagnosis", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue({
      ...mockAssessment,
      modelVersion: {
        ...mockAssessment.modelVersion,
        diagnosisEngineVersion: "v2",
      },
    } as never);
    vi.mocked(loadDomainsWithQuestions).mockResolvedValue(mockDomains as never);
    vi.mocked(loadLayers).mockResolvedValue(mockLayers as never);
    vi.mocked(countAnswersForAssessment).mockResolvedValue(2);
    vi.mocked(countActiveQuestions).mockResolvedValue(2);
    vi.mocked(getAnswersWithDetails).mockResolvedValue(mockAnswers as never);
    vi.mocked(toScoringDomainInputs).mockReturnValue([
      {
        id: "domain-1",
        slug: "persona",
        name: "Persona",
        layerId: "layer-1",
        layerSlug: "layer-1",
        displayOrder: 1,
      },
    ]);
    vi.mocked(toScoringLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1", displayOrder: 1 },
    ]);
    vi.mocked(toDiagnosisDomainInputs).mockReturnValue([
      { id: "domain-1", slug: "persona", name: "Persona", weight: 1.4 },
    ]);
    vi.mocked(toDiagnosisLayerInputs).mockReturnValue([
      { id: "layer-1", slug: "layer-1", name: "Layer 1" },
    ]);
    vi.mocked(persistAssessmentResults).mockResolvedValue({
      report: { id: "report-v2" },
      bottlenecks: [],
      diagnoses: [],
    } as never);

    await finishAssessment("assessment-1");

    const persisted = vi.mocked(persistAssessmentResults).mock.calls[0][0];
    expect(persisted.reportSpec).not.toBeNull();
    expect(persisted.reportSpec?.capacityMode).toBe("free");
    expect(persisted.structuredDiagnosis).toBeTruthy();
  });
});

describe("updateBusinessMetrics", () => {
  const structuredDiagnosis = runDiagnosisV2FromRawScores({
    rawByEngineId: Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => [index + 1, 6]),
    ),
  });

  const completedAssessment = {
    ...mockAssessment,
    status: "completed" as const,
    structuredDiagnosis,
    report: { id: "report-1" },
    monthlyRevenue: null,
    averageOrderValue: null,
    monthlyLeads: null,
    repeatPurchaseRate: null,
  };

  it("rejects when assessment is not completed", async () => {
    vi.mocked(findAssessmentById).mockResolvedValue(mockAssessment as never);

    await expect(
      updateBusinessMetrics("assessment-1", {
        monthlyRevenue: 1_000_000,
        averageOrderValue: 10_000,
        monthlyLeads: 100,
      }),
    ).rejects.toMatchObject({
      code: "assessment_not_completed",
      status: 409,
    });

    expect(updateAssessmentBusinessMetrics).not.toHaveBeenCalled();
  });

  it("saves metrics and re-composes reportSpec with valueAtStake", async () => {
    vi.mocked(findAssessmentById)
      .mockResolvedValueOnce(completedAssessment as never)
      .mockResolvedValueOnce({
        ...completedAssessment,
        monthlyRevenue: 1_000_000,
        averageOrderValue: 10_000,
        monthlyLeads: 100,
        repeatPurchaseRate: null,
      } as never);
    vi.mocked(loadDomainsWithQuestions).mockResolvedValue(mockDomains as never);
    vi.mocked(getAnswersWithDetails).mockResolvedValue(mockAnswers as never);
    vi.mocked(updateAssessmentBusinessMetrics).mockResolvedValue({} as never);
    vi.mocked(updateReportSpec).mockResolvedValue({ id: "report-1" } as never);

    const result = await updateBusinessMetrics("assessment-1", {
      monthlyRevenue: 1_000_000,
      averageOrderValue: 10_000,
      monthlyLeads: 100,
    });

    expect(updateAssessmentBusinessMetrics).toHaveBeenCalledWith("assessment-1", {
      monthlyRevenue: 1_000_000,
      averageOrderValue: 10_000,
      monthlyLeads: 100,
      repeatPurchaseRate: undefined,
    });
    expect(updateReportSpec).toHaveBeenCalledOnce();
    expect(result.report.id).toBe("report-1");
    expect(result.report.reportSpec).not.toBeNull();
    expect(result.report.reportSpec?.valueAtStake).not.toBeNull();
  });
});

describe("validateBusinessMetricsRequest", () => {
  it("rejects non-positive metrics", () => {
    expect(() =>
      validateBusinessMetricsRequest({
        monthlyRevenue: 0,
        averageOrderValue: 10_000,
        monthlyLeads: 100,
      }),
    ).toThrow(AppError);
  });

  it("accepts valid metrics with optional repeatPurchaseRate", () => {
    const parsed = validateBusinessMetricsRequest({
      monthlyRevenue: 1_000_000,
      averageOrderValue: 10_000,
      monthlyLeads: 100,
      repeatPurchaseRate: 1.2,
    });

    expect(parsed).toEqual({
      monthlyRevenue: 1_000_000,
      averageOrderValue: 10_000,
      monthlyLeads: 100,
      repeatPurchaseRate: 1.2,
    });
  });
});
