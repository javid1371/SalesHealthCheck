import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  createConsultationRequest: vi.fn(),
  findConsultationRequestByAssessmentSessionId: vi.fn(),
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

import { submitConsultationRequest } from "@/modules/consultation/consultation.service";

describe("submitConsultationRequest access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assessmentMock.findAssessmentById.mockResolvedValue({
      resultToken: "token-abc",
      userId: "user-1",
    });
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue(null);
    repoMock.createConsultationRequest.mockResolvedValue({
      id: "lead-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  const basePayload = {
    assessmentSessionId: "assessment-1",
    name: "Test User",
    phone: "09123456789",
  };

  it("allows submission with a matching token and no session", async () => {
    const result = await submitConsultationRequest({
      ...basePayload,
      token: "token-abc",
    });
    expect(result.id).toBe("lead-1");
  });

  it("allows submission with no token when the caller's session owns the assessment", async () => {
    const result = await submitConsultationRequest(
      { ...basePayload },
      { userSession: { userId: "user-1" } },
    );
    expect(result.id).toBe("lead-1");
  });

  it("rejects submission with no token and a session for a different user", async () => {
    await expect(
      submitConsultationRequest(
        { ...basePayload },
        { userSession: { userId: "someone-else" } },
      ),
    ).rejects.toMatchObject({ code: "report_access_denied", status: 403 });
  });

  it("rejects submission with no token and no session", async () => {
    await expect(submitConsultationRequest({ ...basePayload })).rejects.toMatchObject(
      { code: "report_access_denied", status: 403 },
    );
  });

  it("rejects submission with a wrong token and no session", async () => {
    await expect(
      submitConsultationRequest({ ...basePayload, token: "wrong-token" }),
    ).rejects.toMatchObject({ code: "report_access_denied", status: 403 });
  });

  it("allows submission for admin session regardless of token", async () => {
    const result = await submitConsultationRequest(
      { ...basePayload },
      { adminSession: { role: "admin" } },
    );
    expect(result.id).toBe("lead-1");
  });
});
