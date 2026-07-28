import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  ASSESSMENT_PIPELINE_STATUSES: [
    "assessment_in_progress",
    "assessment_incomplete",
    "assessment_completed",
  ],
  assignLeadToExpertIfUnassigned: vi.fn(),
  attachReportToLeadIfMissing: vi.fn(),
  clearAssignScheduledFor: vi.fn(),
  createConsultationRequest: vi.fn(),
  createLeadActivity: vi.fn(),
  findAssessmentInProgressLeadsForStaleCheck: vi.fn(),
  findConsultationRequestByAssessmentSessionId: vi.fn(),
  findConsultationRequestById: vi.fn(),
  findConsultationRequestByUserId: vi.fn(),
  findDueSystemLeadsForAssignment: vi.fn(),
  findUnassignedOpenLeadsForAssignment: vi.fn(),
  transitionLeadToAssessmentCompleted: vi.fn(),
  transitionLeadToAssessmentIncomplete: vi.fn(),
  updateLeadAssessmentBinding: vi.fn(),
  updateLeadPurchaseProbability: vi.fn(),
  upgradeConsultationRequestToDirect: vi.fn(),
  upgradeConsultationRequestToMessenger: vi.fn(),
}));

const assessmentMock = vi.hoisted(() => ({
  findAssessmentById: vi.fn(),
}));

const staffMock = vi.hoisted(() => ({
  pickNextSalesExpert: vi.fn(),
  findStaffUserById: vi.fn(),
}));

const smsMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

const leadConfigMock = vi.hoisted(() => ({
  getLeadSettings: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    appBaseUrl: "https://app.example.com",
  },
}));
vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/assessment/assessment.repository", () => assessmentMock);
vi.mock("@/modules/staff/staff.repository", () => staffMock);
vi.mock("@/modules/consultation/lead-config.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/consultation/lead-config.service")
  >();
  return {
    ...actual,
    getLeadSettings: (...args: unknown[]) =>
      leadConfigMock.getLeadSettings(...args),
  };
});
vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSenderFromSettings: async () => ({ sendMessage: smsMock.sendMessage }),
}));

describe("lead-assignment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: "لید جدید داری\nچک کن",
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
    });
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-1",
      name: "Lead User",
      phone: "09120000000",
      assignedToId: null,
      assessmentSessionId: null,
      status: "new",
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
      adminProbabilityOverridePercent: null,
    });
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue(null);
    repoMock.findConsultationRequestByUserId.mockResolvedValue(null);
    repoMock.updateLeadAssessmentBinding.mockResolvedValue({});
    assessmentMock.findAssessmentById.mockResolvedValue({
      userId: "user-1",
      user: { name: "Test User", phone: "09121111111", email: "test@example.com" },
      organization: { businessName: "Test Biz" },
      structuredDiagnosis: null,
      report: null,
    });
    repoMock.createConsultationRequest.mockResolvedValue({
      id: "system-lead-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    staffMock.pickNextSalesExpert.mockResolvedValue({
      id: "expert-1",
      phone: "09121111111",
      name: "Expert One",
    });
    staffMock.findStaffUserById.mockResolvedValue({
      id: "expert-1",
      phone: "09121111111",
      name: "Expert One",
    });
    repoMock.assignLeadToExpertIfUnassigned.mockResolvedValue(true);
    repoMock.clearAssignScheduledFor.mockResolvedValue({});
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
    repoMock.transitionLeadToAssessmentCompleted.mockResolvedValue({
      transitioned: true,
      fromStatus: "assessment_in_progress",
    });
    repoMock.transitionLeadToAssessmentIncomplete.mockResolvedValue({
      transitioned: true,
      fromStatus: "assessment_in_progress",
    });
    repoMock.findAssessmentInProgressLeadsForStaleCheck.mockResolvedValue([]);
    repoMock.findUnassignedOpenLeadsForAssignment.mockResolvedValue([]);
    smsMock.sendMessage.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("autoAssignAndNotifyLead assigns round-robin expert and sends SMS", async () => {
    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).toHaveBeenCalledWith({
      excludeIds: [],
      maxOpenLeadsPerExpert: 30,
      preferStaffId: null,
    });
    expect(repoMock.assignLeadToExpertIfUnassigned).toHaveBeenCalledWith(
      "lead-1",
      "expert-1",
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationRequestId: "lead-1",
        staffUserId: null,
        type: "assignment_change",
        detail: expect.stringContaining('"toId":"expert-1"'),
      }),
    );
    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09121111111",
      "لید جدید داری\nچک کن",
    );
  });

  it("interpolates expert SMS placeholders and includes lead detail URL", async () => {
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms:
        "لید {{name}} — {{phone}} — {{probability}}\n{{detailUrl}}",
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
    });
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-9",
      name: "سارا",
      phone: "09123334444",
      assignedToId: null,
      assessmentSessionId: null,
      status: "new",
      purchaseProbabilityPercent: 72,
      purchaseProbabilityBand: "high",
      adminProbabilityOverridePercent: null,
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-9");

    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09121111111",
      "لید سارا — 09123334444 — بالا — 72٪\nhttps://app.example.com/expert/consultations/lead-9",
    );
  });

  it("falls back to default expert SMS when interpolated body exceeds max length", async () => {
    const longName = "ن".repeat(480);
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: `لید {{name}} {{detailUrl}}`,
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
      staleNewLeadHours: 24,
    });
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-long",
      name: longName,
      phone: "09120000000",
      assignedToId: null,
      assessmentSessionId: null,
      status: "new",
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
      adminProbabilityOverridePercent: null,
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );
    const { DEFAULT_EXPERT_NEW_LEAD_SMS } = await import(
      "@/modules/consultation/lead-config.service"
    );

    await autoAssignAndNotifyLead("lead-long");

    expect(repoMock.assignLeadToExpertIfUnassigned).toHaveBeenCalled();
    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09121111111",
      DEFAULT_EXPERT_NEW_LEAD_SMS,
    );
  });

  it("passes excluded staff IDs into round-robin picker", async () => {
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: "لید جدید داری\nچک کن",
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: ["amin-id"],
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).toHaveBeenCalledWith({
      excludeIds: ["amin-id"],
      maxOpenLeadsPerExpert: 30,
      preferStaffId: null,
    });
  });

  it("passes hotLeadDirectAssigneeId as preferStaffId only for high-band leads", async () => {
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: "لید جدید داری\nچک کن",
      maxOpenLeadsPerExpert: 20,
      hotLeadDirectAssigneeId: "hot-expert",
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
    });
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-1",
      name: "Lead User",
      phone: "09120000000",
      assignedToId: null,
      assessmentSessionId: null,
      status: "new",
      purchaseProbabilityPercent: 80,
      purchaseProbabilityBand: "high",
      adminProbabilityOverridePercent: null,
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).toHaveBeenCalledWith({
      excludeIds: [],
      maxOpenLeadsPerExpert: 20,
      preferStaffId: "hot-expert",
    });
  });

  it("does not prefer hot assignee for non-high purchase probability", async () => {
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: "لید جدید داری\nچک کن",
      maxOpenLeadsPerExpert: 20,
      hotLeadDirectAssigneeId: "hot-expert",
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
    });
    repoMock.findConsultationRequestById.mockResolvedValue({
      id: "lead-1",
      name: "Lead User",
      phone: "09120000000",
      assignedToId: null,
      assessmentSessionId: null,
      status: "assessment_in_progress",
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
      adminProbabilityOverridePercent: null,
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).toHaveBeenCalledWith({
      excludeIds: [],
      maxOpenLeadsPerExpert: 20,
      preferStaffId: null,
    });
  });

  it("skips assignment when feature flag is disabled", async () => {
    leadConfigMock.getLeadSettings.mockResolvedValue({
      autoAssignEnabled: false,
      systemAssignDelayHours: 24,
      expertNewLeadSms: "لید جدید داری\nچک کن",
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
    });

    const { autoAssignAndNotifyLead } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await autoAssignAndNotifyLead("lead-1");

    expect(staffMock.pickNextSalesExpert).not.toHaveBeenCalled();
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("createLeadOnAssessmentStart creates in-progress lead and soft-assigns without SMS", async () => {
    const { createLeadOnAssessmentStart } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createLeadOnAssessmentStart({
      assessmentSessionId: "assessment-1",
      name: "Test User",
      phone: "09121111111",
      email: "test@example.com",
    });

    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith({
      name: "Test User",
      phone: "09121111111",
      email: "test@example.com",
      assessmentSessionId: "assessment-1",
      source: "system",
      status: "assessment_in_progress",
    });
    expect(staffMock.pickNextSalesExpert).toHaveBeenCalled();
    expect(repoMock.assignLeadToExpertIfUnassigned).toHaveBeenCalledWith(
      "system-lead-1",
      "expert-1",
    );
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("createLeadOnAssessmentStart reuses the user's existing pipeline lead", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue(null);
    repoMock.findConsultationRequestByUserId.mockResolvedValue({
      id: "existing-lead",
      status: "assessment_completed",
      assignedToId: "expert-1",
    });

    const { createLeadOnAssessmentStart } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createLeadOnAssessmentStart({
      assessmentSessionId: "assessment-2",
      name: "Test User",
      phone: "09121111111",
    });

    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(repoMock.updateLeadAssessmentBinding).toHaveBeenCalledWith(
      "existing-lead",
      expect.objectContaining({
        assessmentSessionId: "assessment-2",
        status: "assessment_in_progress",
      }),
    );
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("createLeadOnAssessmentStart does not regress CRM lead status", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "crm-lead",
      status: "contacted",
      assignedToId: "expert-1",
    });

    const { createLeadOnAssessmentStart } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createLeadOnAssessmentStart({
      assessmentSessionId: "assessment-2",
      name: "Test User",
      phone: "09121111111",
    });

    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(repoMock.updateLeadAssessmentBinding).toHaveBeenCalledWith(
      "crm-lead",
      expect.objectContaining({
        assessmentSessionId: "assessment-2",
      }),
    );
    expect(repoMock.updateLeadAssessmentBinding.mock.calls[0]?.[1]).not.toHaveProperty(
      "status",
    );
  });

  it("transitionLeadOnAssessmentComplete moves in-progress lead to completed", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "existing-lead",
      status: "assessment_in_progress",
    });

    const { transitionLeadOnAssessmentComplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await transitionLeadOnAssessmentComplete({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "warm",
    });

    expect(repoMock.transitionLeadToAssessmentCompleted).toHaveBeenCalledWith(
      "existing-lead",
      "report-1",
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "existing-lead",
      staffUserId: null,
      type: "status_change",
      detail: "assessment_in_progress→assessment_completed",
    });
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("transitionLeadOnAssessmentComplete moves incomplete lead to completed", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "incomplete-lead",
      status: "assessment_incomplete",
    });
    repoMock.transitionLeadToAssessmentCompleted.mockResolvedValue({
      transitioned: true,
      fromStatus: "assessment_incomplete",
    });

    const { transitionLeadOnAssessmentComplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await transitionLeadOnAssessmentComplete({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "cold",
    });

    expect(repoMock.transitionLeadToAssessmentCompleted).toHaveBeenCalledWith(
      "incomplete-lead",
      "report-1",
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "incomplete-lead",
      staffUserId: null,
      type: "status_change",
      detail: "assessment_incomplete→assessment_completed",
    });
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("transitionLeadOnAssessmentComplete does not regress CRM statuses", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "crm-lead",
      status: "contacted",
    });
    repoMock.transitionLeadToAssessmentCompleted.mockResolvedValue({
      transitioned: false,
      fromStatus: "contacted",
    });

    const { transitionLeadOnAssessmentComplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await transitionLeadOnAssessmentComplete({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "hot",
    });

    expect(repoMock.attachReportToLeadIfMissing).toHaveBeenCalledWith(
      "crm-lead",
      "report-1",
    );
    expect(repoMock.createLeadActivity).not.toHaveBeenCalled();
  });

  it("transitionLeadOnAssessmentComplete creates completed lead when start lead is missing", async () => {
    const { transitionLeadOnAssessmentComplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await transitionLeadOnAssessmentComplete({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "cold",
    });

    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentSessionId: "assessment-1",
        reportId: "report-1",
        source: "system",
        status: "assessment_completed",
      }),
    );
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("upgradeExistingLeadToDirect sets new status path and notifies assigned expert", async () => {
    repoMock.findConsultationRequestById.mockImplementation(async () => ({
      id: "existing-lead",
      name: "Direct User",
      phone: "09123456789",
      status: "assessment_completed",
      assignedToId: "expert-1",
      assessmentSessionId: "assessment-1",
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
      adminProbabilityOverridePercent: null,
    }));
    repoMock.upgradeConsultationRequestToDirect.mockResolvedValue({
      id: "existing-lead",
      status: "new",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { upgradeExistingLeadToDirect } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const result = await upgradeExistingLeadToDirect("existing-lead", {
      name: "Direct User",
      phone: "09123456789",
      assessmentSessionId: "assessment-1",
    });

    expect(result.id).toBe("existing-lead");
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "existing-lead",
      staffUserId: null,
      type: "status_change",
      detail: "assessment_completed→new",
    });
    expect(staffMock.findStaffUserById).toHaveBeenCalledWith("expert-1");
    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09121111111",
      "لید جدید داری\nچک کن",
    );
  });

  it.each([
    "assessment_in_progress",
    "assessment_incomplete",
  ] as const)(
    "upgradeExistingLeadToDirect from %s records status change and notifies expert",
    async (fromStatus) => {
      repoMock.findConsultationRequestById.mockImplementation(async () => ({
        id: "pipeline-lead",
        name: "Consult User",
        phone: "09123456789",
        status: fromStatus,
        assignedToId: "expert-1",
        assessmentSessionId: "assessment-1",
        purchaseProbabilityPercent: null,
        purchaseProbabilityBand: null,
        adminProbabilityOverridePercent: null,
      }));
      repoMock.upgradeConsultationRequestToDirect.mockResolvedValue({
        id: "pipeline-lead",
        status: "new",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const { upgradeExistingLeadToDirect } = await import(
        "@/modules/consultation/lead-assignment.service"
      );

      await upgradeExistingLeadToDirect("pipeline-lead", {
        name: "Consult User",
        phone: "09123456789",
        assessmentSessionId: "assessment-1",
      });

      expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
        consultationRequestId: "pipeline-lead",
        staffUserId: null,
        type: "status_change",
        detail: `${fromStatus}→new`,
      });
      expect(smsMock.sendMessage).toHaveBeenCalledWith(
        "09121111111",
        "لید جدید داری\nچک کن",
      );
    },
  );

  it("upgradeExistingLeadToMessenger notifies assigned expert on consultation upgrade", async () => {
    repoMock.findConsultationRequestById.mockImplementation(async () => ({
      id: "messenger-lead",
      name: "Messenger User",
      phone: "09123456789",
      status: "assessment_in_progress",
      assignedToId: "expert-1",
      assessmentSessionId: "assessment-1",
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
      adminProbabilityOverridePercent: null,
    }));
    repoMock.upgradeConsultationRequestToMessenger.mockResolvedValue({
      id: "messenger-lead",
      status: "new",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { upgradeExistingLeadToMessenger } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await upgradeExistingLeadToMessenger("messenger-lead", {
      name: "Messenger User",
      phone: "09123456789",
      assessmentSessionId: "assessment-1",
    });

    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "messenger-lead",
      staffUserId: null,
      type: "status_change",
      detail: "assessment_in_progress→new",
    });
    expect(smsMock.sendMessage).toHaveBeenCalled();
  });

  it("processStaleAssessmentLeads moves abandoned and stale in-progress leads", async () => {
    const staleDate = new Date(Date.now() - 30 * 60 * 60 * 1000);
    repoMock.findAssessmentInProgressLeadsForStaleCheck.mockResolvedValue([
      {
        id: "lead-abandoned",
        status: "assessment_in_progress",
        updatedAt: new Date(),
        assessmentSession: {
          id: "assessment-abandoned",
          status: "abandoned",
          updatedAt: new Date(),
          startedAt: new Date(),
          answers: [],
        },
      },
      {
        id: "lead-stale",
        status: "assessment_in_progress",
        updatedAt: staleDate,
        assessmentSession: {
          id: "assessment-stale",
          status: "in_progress",
          updatedAt: staleDate,
          startedAt: staleDate,
          answers: [{ answeredAt: staleDate }],
        },
      },
      {
        id: "lead-fresh",
        status: "assessment_in_progress",
        updatedAt: new Date(),
        assessmentSession: {
          id: "assessment-fresh",
          status: "in_progress",
          updatedAt: new Date(),
          startedAt: new Date(),
          answers: [{ answeredAt: new Date() }],
        },
      },
    ]);
    repoMock.findConsultationRequestByAssessmentSessionId.mockImplementation(
      async (assessmentSessionId: string) => ({
        id: `lead-for-${assessmentSessionId}`,
        status: "assessment_in_progress",
      }),
    );

    const { processStaleAssessmentLeads } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const processed = await processStaleAssessmentLeads();

    expect(processed).toBe(2);
    expect(repoMock.transitionLeadToAssessmentIncomplete).toHaveBeenCalledTimes(
      2,
    );
  });

  it("markAssessmentLeadIncomplete transitions only in-progress leads", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "lead-1",
      status: "assessment_in_progress",
    });

    const { markAssessmentLeadIncomplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const moved = await markAssessmentLeadIncomplete("assessment-1");

    expect(moved).toBe(true);
    expect(repoMock.transitionLeadToAssessmentIncomplete).toHaveBeenCalledWith(
      "lead-1",
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: null,
      type: "status_change",
      detail: "assessment_in_progress→assessment_incomplete",
    });
  });

  it("markAssessmentLeadIncomplete is a no-op outside assessment_in_progress", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "lead-crm",
      status: "contacted",
    });
    repoMock.transitionLeadToAssessmentIncomplete.mockResolvedValue({
      transitioned: false,
      fromStatus: "contacted",
    });

    const { markAssessmentLeadIncomplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const moved = await markAssessmentLeadIncomplete("assessment-1");

    expect(moved).toBe(false);
    expect(repoMock.createLeadActivity).not.toHaveBeenCalled();
  });

  it("createSystemLeadIfEligible delegates to assessment-complete transition", async () => {
    repoMock.findConsultationRequestByAssessmentSessionId.mockResolvedValue({
      id: "existing-lead",
      status: "assessment_in_progress",
    });

    const { createSystemLeadIfEligible } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createSystemLeadIfEligible({
      assessmentSessionId: "assessment-1",
      reportId: "report-1",
      leadScore: "hot",
    });

    expect(repoMock.transitionLeadToAssessmentCompleted).toHaveBeenCalledWith(
      "existing-lead",
      "report-1",
    );
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
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

  it("processUnassignedLeadAssignments assigns open unassigned leads", async () => {
    const assigned = new Set<string>();
    repoMock.findUnassignedOpenLeadsForAssignment.mockResolvedValue([
      { id: "open-1", status: "new" },
      { id: "open-2", status: "assessment_in_progress" },
    ]);
    repoMock.findConsultationRequestById.mockImplementation(
      async (id: string) => ({
        id,
        name: "Open Lead",
        phone: "09120000000",
        assignedToId: assigned.has(id) ? "expert-1" : null,
        status: id === "open-2" ? "assessment_in_progress" : "new",
        purchaseProbabilityPercent: null,
        purchaseProbabilityBand: null,
        adminProbabilityOverridePercent: null,
      }),
    );
    repoMock.assignLeadToExpertIfUnassigned.mockImplementation(
      async (leadId: string) => {
        assigned.add(leadId);
        return true;
      },
    );

    const { processUnassignedLeadAssignments } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const processed = await processUnassignedLeadAssignments();

    expect(processed).toBe(2);
    expect(staffMock.pickNextSalesExpert).toHaveBeenCalledTimes(2);
    // Mid-assessment soft lead: no SMS for that assignment path.
    expect(smsMock.sendMessage).toHaveBeenCalledTimes(1);
  });
});
