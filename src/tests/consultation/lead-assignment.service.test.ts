import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  assignLeadToExpertIfUnassigned: vi.fn(),
  createConsultationRequest: vi.fn(),
  findConsultationRequestByAssessmentSessionId: vi.fn(),
  findConsultationRequestById: vi.fn(),
  updateLeadPurchaseProbability: vi.fn(),
}));

const staffMock = vi.hoisted(() => ({
  pickNextSalesExpert: vi.fn(),
}));

const smsMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/staff/staff.repository", () => staffMock);
vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSender: () => ({ sendMessage: smsMock.sendMessage }),
}));

describe("lead-assignment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEAD_AUTO_ASSIGN_ENABLED", "true");
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-1",
      assignedToId: null,
      assessmentSessionId: null,
    });
    staffMock.pickNextSalesExpert.mockResolvedValue({
      id: "expert-1",
      phone: "09121111111",
      name: "Expert One",
    });
    repoMock.assignLeadToExpertIfUnassigned.mockResolvedValue(true);
    smsMock.sendMessage.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("autoAssignAndNotifyLead assigns round-robin expert and sends SMS", async () => {
    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).toHaveBeenCalled();
    expect(repoMock.assignLeadToExpertIfUnassigned).toHaveBeenCalledWith(
      "lead-1",
      "expert-1",
    );
    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09121111111",
      "لید جدید داری\nچک کن",
    );
  });

  it("skips assignment when feature flag is disabled", async () => {
    vi.stubEnv("LEAD_AUTO_ASSIGN_ENABLED", "false");
    vi.resetModules();

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).not.toHaveBeenCalled();
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("createSystemLeadIfEligible skips cold assessments", async () => {
    const { createSystemLeadIfEligible } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createSystemLeadIfEligible({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "cold",
    });

    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
  });

  it("createSystemLeadIfEligible dedupes existing leads", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "existing-lead",
    });

    const { createSystemLeadIfEligible } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createSystemLeadIfEligible({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "hot",
    });

    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
  });
});
