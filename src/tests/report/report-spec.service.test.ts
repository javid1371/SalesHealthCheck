import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    capacityMode: "free" as const,
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/modules/assessment/assessment.repository", () => ({
  findReportById: vi.fn(),
  findAssessmentForResult: vi.fn(),
  getAnswersWithDetails: vi.fn(),
  updateReportSpec: vi.fn(),
}));

vi.mock("@/modules/question-bank/question-bank.repository", () => ({
  loadDomainsWithQuestions: vi.fn(),
  loadLayers: vi.fn(),
}));

vi.mock("@/modules/report/report.builder", () => ({
  buildReportSpec: vi.fn(),
}));

import {
  findAssessmentForResult,
  findReportById,
  getAnswersWithDetails,
  updateReportSpec,
} from "@/modules/assessment/assessment.repository";
import { loadDomainsWithQuestions, loadLayers } from "@/modules/question-bank/question-bank.repository";
import { buildReportSpec } from "@/modules/report/report.builder";
import {
  ensureReportSpec,
  hasRadarChart,
  parseReportSpec,
} from "@/modules/report/report-spec.service";
import type { ReportSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";

const mockFindReportById = vi.mocked(findReportById);
const mockFindAssessmentForResult = vi.mocked(findAssessmentForResult);
const mockGetAnswersWithDetails = vi.mocked(getAnswersWithDetails);
const mockUpdateReportSpec = vi.mocked(updateReportSpec);
const mockLoadDomainsWithQuestions = vi.mocked(loadDomainsWithQuestions);
const mockLoadLayers = vi.mocked(loadLayers);
const mockBuildReportSpec = vi.mocked(buildReportSpec);

const existingSpec: ReportSpec = {
  survivalBanner: { status: "GREEN", tone: "optimization" },
  healthDisplay: 70,
  charts: [{ kind: "radar", data: { domains: [] } }],
  quickWinTeaser: null,
  issues: [],
  domainBreakdown: [],
  valueAtStake: null,
  quickWin: null,
  lockedPlan: { titles: [] },
  ctas: [],
  capacityMode: "free",
  confidenceNote: { level: "medium", instrumentFirst: false },
  expertView: {
    leadScore: "warm",
    suggestedOffer: "consultation",
    appetizerActions: [],
    disclosureGuide: "",
  },
};

describe("report-spec.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects radar chart in report spec", () => {
    expect(hasRadarChart(existingSpec)).toBe(true);
    expect(hasRadarChart(parseReportSpec({ charts: [{ kind: "survival", data: {} }] }))).toBe(
      false,
    );
  });

  it("returns existing spec without persisting when radar is present", async () => {
    mockFindReportById.mockResolvedValue({
      id: "report-1",
      assessmentSessionId: "assessment-1",
      reportSpec: existingSpec,
    } as Awaited<ReturnType<typeof findReportById>>);

    const result = await ensureReportSpec("report-1");

    expect(result).toEqual(existingSpec);
    expect(mockUpdateReportSpec).not.toHaveBeenCalled();
  });

  it("recomposes and persists spec from structuredDiagnosis", async () => {
    const structuredDiagnosis = { healthWeighted: 0.55 } as StructuredDiagnosis;
    const rebuiltSpec = {
      ...existingSpec,
      healthDisplay: 55,
    };

    mockFindReportById.mockResolvedValue({
      id: "report-1",
      assessmentSessionId: "assessment-1",
      reportSpec: null,
      structuredReport: {},
    } as Awaited<ReturnType<typeof findReportById>>);

    mockFindAssessmentForResult.mockResolvedValue({
      id: "assessment-1",
      modelVersionId: "model-1",
      structuredDiagnosis,
      domainScores: [
        {
          domainId: "d1",
          rawScore: 8,
          maxScore: 15,
          percentage: 53,
          healthLevel: "medium",
          domain: { slug: "persona", name: "شخصیت", displayOrder: 2, layer: { name: "L1" } },
        },
      ],
      layerScores: [
        {
          layerId: "l1",
          rawScore: 10,
          maxScore: 20,
          percentage: 50,
          healthLevel: "medium",
          layer: { slug: "foundation", name: "پایه" },
        },
      ],
      bottlenecks: [],
      overallScore: {
        rawScore: 80,
        maxScore: 160,
        percentage: 50,
        healthLevel: "medium",
      },
      report: { id: "report-1" },
    } as Awaited<ReturnType<typeof findAssessmentForResult>>);

    mockLoadDomainsWithQuestions.mockResolvedValue([
      { slug: "persona", name: "شخصیت" },
    ] as Awaited<ReturnType<typeof loadDomainsWithQuestions>>);
    mockLoadLayers.mockResolvedValue([
      { id: "l1", slug: "foundation", name: "پایه" },
    ] as Awaited<ReturnType<typeof loadLayers>>);
    mockGetAnswersWithDetails.mockResolvedValue([]);
    mockBuildReportSpec.mockReturnValue(rebuiltSpec);

    const result = await ensureReportSpec("report-1");

    expect(result).toEqual(rebuiltSpec);
    expect(mockBuildReportSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        domainScores: [
          expect.objectContaining({ domainSlug: "persona", percentage: 53 }),
        ],
        layerScores: [
          expect.objectContaining({ layerSlug: "foundation", percentage: 50 }),
        ],
      }),
    );
    expect(mockUpdateReportSpec).toHaveBeenCalledWith("report-1", rebuiltSpec);
  });

  it("builds legacy radar spec when structuredDiagnosis is missing", async () => {
    mockFindReportById.mockResolvedValue({
      id: "report-2",
      assessmentSessionId: "assessment-2",
      reportSpec: null,
      structuredReport: {
        diagnosisSummary: { survivalStatus: "AMBER" },
      },
    } as Awaited<ReturnType<typeof findReportById>>);

    mockFindAssessmentForResult.mockResolvedValue({
      id: "assessment-2",
      modelVersionId: "model-1",
      structuredDiagnosis: null,
      domainScores: [
        {
          domainId: "d1",
          rawScore: 8,
          maxScore: 15,
          percentage: 53,
          healthLevel: "medium",
          domain: { slug: "persona", name: "شخصیت", displayOrder: 2, layer: { name: "L1" } },
        },
      ],
      layerScores: [],
      bottlenecks: [],
      overallScore: {
        rawScore: 80,
        maxScore: 160,
        percentage: 53,
        healthLevel: "medium",
      },
      report: { id: "report-2" },
    } as Awaited<ReturnType<typeof findAssessmentForResult>>);

    const result = await ensureReportSpec("report-2");

    expect(result.survivalBanner.status).toBe("AMBER");
    expect(result.charts.some((chart) => chart.kind === "radar")).toBe(true);
    expect(mockUpdateReportSpec).toHaveBeenCalledWith("report-2", result);
    expect(mockBuildReportSpec).not.toHaveBeenCalled();
  });
});
