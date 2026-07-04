import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  createConsultationRequest: vi.fn(),
  findConsultationRequestByAssessmentSessionId: vi.fn(),
  upgradeConsultationRequestToDirect: vi.fn(),
}));

const leadAssignmentMock = vi.hoisted(() => ({
  finalizeNewLead: vi.fn(),
  upgradeExistingLeadToDirect: vi.fn(),
}));

const assessmentMock = vi.hoisted(() => ({
  findAssessmentById: vi.fn(),
  findReportById: vi.fn(),
}));

const funnelMock = vi.hoisted(() => ({
  hookConsultationSubmitted: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/consultation/lead-assignment.service", () => leadAssignmentMock);
vi.mock("@/modules/assessment/assessment.repository", () => assessmentMock);
vi.mock("@/modules/sms-funnel/hooks", () => funnelMock);

describe("submitConsultationRequest upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assessmentMock.findAssessmentById.mockResolvedValue({
      resultToken: "token-abc",
      userId: "user-1",
    });
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "existing-system-lead",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    leadAssignmentMock.upgradeExistingLeadToDirect.mockResolvedValue({
      id: "existing-system-lead",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("upgrades existing system lead instead of creating duplicate", async () => {
    const { submitConsultationRequest } = await import(
      "@/modules/consultation/consultation.service"
    );

    const result = await submitConsultationRequest({
      assessmentSessionId: "assessment-1",
      token: "token-abc",
      name: "Direct User",
      phone: "09123456789",
      message: "Need help",
    });

    expect(result.id).toBe("existing-system-lead");
    expect(leadAssignmentMock.upgradeExistingLeadToDirect).toHaveBeenCalledWith(
      "existing-system-lead",
      expect.objectContaining({
        name: "Direct User",
        phone: "09123456789",
        message: "Need help",
        assessmentSessionId: "assessment-1",
      }),
    );
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
  });
});
