import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  assignLeadToExpertIfUnassigned: vi.fn(),
  clearAssignScheduledFor: vi.fn(),
  createConsultationRequest: vi.fn(),
  findConsultationRequestByAssessmentSessionId: vi.fn(),
  findConsultationRequestById: vi.fn(),
  findDueSystemLeadsForAssignment: vi.fn(),
  updateLeadPurchaseProbability: vi.fn(),
  upgradeConsultationRequestToDirect: vi.fn(),
}));

const assessmentMock = vi.hoisted(() => ({
  findAssessmentById: vi.fn(),
}));

const staffMock = vi.hoisted(() => ({
  pickNextSalesExpert: vi.fn(),
}));

const smsMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/assessment/assessment.repository", () => assessmentMock);
vi.mock("@/modules/staff/staff.repository", () => staffMock);
vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSenderFromSettings: async () => ({ sendMessage: smsMock.sendMessage }),
}));

describe("lead-assignment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEAD_AUTO_ASSIGN_ENABLED", "true");
    vi.stubEnv("LEAD_SYSTEM_ASSIGN_DELAY_HOURS", "24");
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-1",
      assignedToId: null,
      assessmentSessionId: null,
    });
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue(null);
    assessmentMock.findAssessmentById.mockResolvedValue({
      user: { name: "Test User", phone: "09121111111", email: "test@example.com" },
      organization: { businessName: "Test Biz" },
    });
    repoMock.createConsultationRequest.mockResolvedValue({ id: "system-lead-1" });
    staffMock.pickNextSalesExpert.mockResolvedValue({
      id: "expert-1",
      phone: "09121111111",
      name: "Expert One",
    });
    repoMock.assignLeadToExpertIfUnassigned.mockResolvedValue(true);
    repoMock.clearAssignScheduledFor.mockResolvedValue({});
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

  it("createSystemLeadIfEligible skips warm assessments", async () => {
    const { createSystemLeadIfEligible } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createSystemLeadIfEligible({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "warm",
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

  it("createSystemLeadIfEligible schedules assignment without immediate assign", async () => {
    const { createSystemLeadIfEligible } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const before = Date.now();
    await createSystemLeadIfEligible({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "hot",
    });
    const after = Date.now();

    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "system",
        assignScheduledFor: expect.any(Date),
      }),
    );

    const call = repoMock.createConsultationRequest.mock.calls[0][0];
    const scheduledAt = call.assignScheduledFor.getTime();
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    expect(scheduledAt).toBeGreaterThanOrEqual(expectedMin);
    expect(scheduledAt).toBeLessThanOrEqual(expectedMax);

    expect(staffMock.pickNextSalesExpert).not.toHaveBeenCalled();
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("processDueSystemLeadAssignments assigns due leads and clears schedule", async () => {
    repoMock.findDueSystemLeadsForAssignment.mockResolvedValue([
      { id: "due-lead-1" },
      { id: "due-lead-2" },
    ]);

    const { processDueSystemLeadAssignments } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const processed = await processDueSystemLeadAssignments();

    expect(processed).toBe(2);
    expect(repoMock.assignLeadToExpertIfUnassigned).toHaveBeenCalledTimes(2);
    expect(repoMock.clearAssignScheduledFor).toHaveBeenCalledWith("due-lead-1");
    expect(repoMock.clearAssignScheduledFor).toHaveBeenCalledWith("due-lead-2");
  });
});
