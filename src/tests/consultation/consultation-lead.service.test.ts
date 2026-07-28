import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  serializeAssignmentChangeDetail,
} from "@/modules/consultation/lead-activity";

const repoMock = vi.hoisted(() => ({
  countConsultationRequests: vi.fn(),
  findConsultationRequests: vi.fn(),
  findConsultationRequestById: vi.fn(),
  updateConsultationLead: vi.fn(),
  addConsultationNote: vi.fn(),
  findConsultationNotes: vi.fn(),
  countLeadsNeedingFollowUp: vi.fn(),
  findLeadsNeedingFollowUp: vi.fn(),
  countClosedLeadsSince: vi.fn(),
  bulkUpdateConsultationLeads: vi.fn(),
  createManualConsultationRequest: vi.fn(),
  createLeadActivity: vi.fn(),
  createLeadCallLog: vi.fn(),
  claimLeadIfUnassignedUnderCapacity: vi.fn(),
  findAllConsultationRequests: vi.fn(),
  findConsultationRequestsByIds: vi.fn(),
}));

const mockRescheduleCallScheduledForFollowUp = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

const staffRepoMock = vi.hoisted(() => ({
  findStaffUserById: vi.fn(),
}));

const leadAssignmentMock = vi.hoisted(() => ({
  finalizeNewLead: vi.fn(),
  upgradeExistingLeadToDirect: vi.fn(),
  notifyLeadTransferToExpert: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);

vi.mock("@/modules/sms-funnel/enrollment.service", () => ({
  rescheduleCallScheduledForFollowUp: (...args: unknown[]) =>
    mockRescheduleCallScheduledForFollowUp(...args),
}));

vi.mock("@/modules/staff/staff.repository", () => staffRepoMock);

vi.mock("@/modules/consultation/lead-assignment.service", () => leadAssignmentMock);

vi.mock("@/modules/consultation/lead-config.service", () => ({
  getLeadSettings: vi.fn().mockResolvedValue({
    autoAssignEnabled: true,
    systemAssignDelayHours: 24,
    expertNewLeadSms: "لید جدید داری\nچک کن",
    maxOpenLeadsPerExpert: 30,
    hotLeadDirectAssigneeId: null,
    assessmentIncompleteAfterHours: 24,
    autoAssignExcludeStaffIds: [],
    staleNewLeadHours: 24,
  }),
}));

import {
  addLeadNote,
  bulkUpdateLeads,
  claimLead,
  createManualLead,
  exportLeadsToCsv,
  getConsultationLeadDetail,
  getExpertDashboard,
  listConsultationRequests,
  logCall,
  transferLead,
  updateConsultationLeadStatus,
} from "@/modules/consultation/consultation.service";
import { serializeCallLoggedDetail } from "@/modules/consultation/lead-activity";

const baseRow = {
  id: "lead-1",
  name: "Lead One",
  phone: "09120000001",
  email: null,
  message: "Need help",
  status: "new" as const,
  source: "direct" as const,
  purchaseProbabilityPercent: null,
  purchaseProbabilityBand: null,
  adminProbabilityOverridePercent: null,
  assignedToId: "expert-1",
  assignScheduledFor: null,
  firstContactedAt: null,
  closedAt: null,
  lastCallOutcome: null,
  lastCalledAt: null,
  lostReason: null,
  lostNote: null,
  nextFollowUpAt: null,
  createdAt: new Date("2026-06-01T10:00:00Z"),
  updatedAt: new Date("2026-06-01T10:00:00Z"),
  assessmentSessionId: null,
  reportId: null,
  assignedTo: { id: "expert-1", name: "Expert User" },
  assessmentSession: null,
  report: null,
  consultationNotes: [],
  leadActivities: [],
};

const adminAccess = {
  adminSession: { role: "admin" as const, staffUserId: "admin-1", name: "Admin" },
  salesExpertSession: null,
};

const expertAccess = {
  adminSession: null,
  salesExpertSession: {
    role: "sales_expert" as const,
    staffUserId: "expert-1",
    name: "Expert User",
  },
};

describe("listConsultationRequests access scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.countConsultationRequests.mockResolvedValue(1);
    repoMock.findConsultationRequests.mockResolvedValue([baseRow]);
  });

  it("admin sees all leads without forced assignee filter", async () => {
    await listConsultationRequests({ page: 1, pageSize: 20 }, adminAccess);

    expect(repoMock.countConsultationRequests).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("expert is scoped to own assigned leads", async () => {
    await listConsultationRequests({ page: 1, pageSize: 20 }, expertAccess);

    expect(repoMock.countConsultationRequests).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      assignedToId: "expert-1",
      onlyUnassigned: false,
    });
  });

  it("expert team queue lists unassigned open leads", async () => {
    await listConsultationRequests(
      { page: 1, pageSize: 20, onlyTeamQueue: true },
      expertAccess,
    );

    expect(repoMock.countConsultationRequests).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      onlyTeamQueue: true,
      onlyUnassigned: true,
      onlyMine: false,
    });
  });

  it("expert without staffUserId gets empty list", async () => {
    const result = await listConsultationRequests(
      { page: 1, pageSize: 20 },
      {
        adminSession: null,
        salesExpertSession: { role: "sales_expert" },
      },
    );

    expect(result.requests).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(repoMock.findConsultationRequests).not.toHaveBeenCalled();
  });
});

describe("getConsultationLeadDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to view any lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);

    const lead = await getConsultationLeadDetail("lead-1", adminAccess);

    expect(lead.id).toBe("lead-1");
    expect(lead.assignedToName).toBe("Expert User");
  });

  it("allows assigned expert to view lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);

    const lead = await getConsultationLeadDetail("lead-1", expertAccess);
    expect(lead.id).toBe("lead-1");
  });

  it("allows expert to view unassigned team-queue lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: null,
      assignedTo: null,
    });

    const lead = await getConsultationLeadDetail("lead-1", expertAccess);
    expect(lead.id).toBe("lead-1");
    expect(lead.assignedToId).toBeNull();
  });

  it("forbids expert viewing another expert's lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
      assignedTo: { id: "expert-2", name: "Other Expert" },
    });

    await expect(
      getConsultationLeadDetail("lead-1", expertAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("updateConsultationLeadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      status: "contacted",
    });
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("expert can update status on assigned lead", async () => {
    const result = await updateConsultationLeadStatus(
      "lead-1",
      { status: "contacted" },
      expertAccess,
    );

    expect(result.status).toBe("contacted");
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      status: "contacted",
      firstContactedAt: expect.any(Date),
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "status_change",
      detail: "new→contacted",
    });
  });

  it("rejects manual move into assessment_in_progress", async () => {
    await expect(
      updateConsultationLeadStatus(
        "lead-1",
        { status: "assessment_in_progress" },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(repoMock.updateConsultationLead).not.toHaveBeenCalled();
  });

  it("expert cannot change assignment", async () => {
    await expect(
      updateConsultationLeadStatus(
        "lead-1",
        { assignedToId: "expert-2" },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("admin can assign lead", async () => {
    staffRepoMock.findStaffUserById.mockImplementation(async (id: string) => {
      if (id === "expert-1") {
        return { id: "expert-1", name: "Expert User", role: "sales_expert", isActive: true };
      }
      if (id === "expert-2") {
        return { id: "expert-2", name: "Other Expert", role: "sales_expert", isActive: true };
      }
      return null;
    });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
      assignedTo: { id: "expert-2", name: "Other Expert" },
    });

    const result = await updateConsultationLeadStatus(
      "lead-1",
      { assignedToId: "expert-2" },
      adminAccess,
    );

    expect(result.assignedToId).toBe("expert-2");
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "admin-1",
      type: "assignment_change",
      detail: serializeAssignmentChangeDetail({
        fromId: "expert-1",
        toId: "expert-2",
        fromName: "Expert User",
        toName: "Other Expert",
      }),
    });
  });

  it("expert cannot override purchase probability", async () => {
    await expect(
      updateConsultationLeadStatus(
        "lead-1",
        { adminProbabilityOverridePercent: 90 },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("admin can override purchase probability", async () => {
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      adminProbabilityOverridePercent: 90,
      purchaseProbabilityPercent: 55,
      purchaseProbabilityBand: "medium",
    });

    const result = await updateConsultationLeadStatus(
      "lead-1",
      { adminProbabilityOverridePercent: 90 },
      adminAccess,
    );

    expect(result.adminProbabilityOverridePercent).toBe(90);
    expect(result.purchaseProbabilityPercent).toBe(90);
  });

  it("reschedules call-scheduled SMS when nextFollowUpAt is set", async () => {
    const followUp = new Date("2026-07-30T12:00:00.000Z");
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assessmentSessionId: "session-1",
      assessmentSession: {
        userId: "user-1",
        user: { id: "user-1", phone: "09120000001" },
        organization: { businessName: "Acme" },
        overallScore: null,
        bottlenecks: [],
        diagnoses: [],
      },
    });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      nextFollowUpAt: followUp,
    });

    await updateConsultationLeadStatus(
      "lead-1",
      { nextFollowUpAt: followUp },
      expertAccess,
    );

    expect(mockRescheduleCallScheduledForFollowUp).toHaveBeenCalledWith({
      userId: "user-1",
      assessmentSessionId: "session-1",
      nextFollowUpAt: followUp,
    });
  });

  it("does not reschedule SMS when nextFollowUpAt is cleared", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      nextFollowUpAt: new Date("2026-07-30T12:00:00.000Z"),
      assessmentSessionId: "session-1",
      assessmentSession: {
        userId: "user-1",
        user: { id: "user-1", phone: "09120000001" },
        organization: { businessName: "Acme" },
        overallScore: null,
        bottlenecks: [],
        diagnoses: [],
      },
    });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      nextFollowUpAt: null,
    });

    await updateConsultationLeadStatus(
      "lead-1",
      { nextFollowUpAt: null },
      expertAccess,
    );

    expect(mockRescheduleCallScheduledForFollowUp).not.toHaveBeenCalled();
  });

  it("rejects closed_lost without lostReason", async () => {
    await expect(
      updateConsultationLeadStatus(
        "lead-1",
        { status: "closed_lost" },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(repoMock.updateConsultationLead).not.toHaveBeenCalled();
  });

  it("saves closed_lost with lostReason and closedAt", async () => {
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      status: "closed_lost",
      lostReason: "price",
      lostNote: null,
      closedAt: new Date(),
    });

    const result = await updateConsultationLeadStatus(
      "lead-1",
      { status: "closed_lost", lostReason: "price" },
      expertAccess,
    );

    expect(result.status).toBe("closed_lost");
    expect(result.lostReason).toBe("price");
    expect(result.lostReasonLabel).toBe("قیمت");
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      status: "closed_lost",
      lostReason: "price",
      lostNote: null,
      closedAt: expect.any(Date),
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "status_change",
      detail: "new→closed_lost",
    });
  });

  it("keeps lostReason history when leaving closed_lost", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      status: "closed_lost",
      lostReason: "competitor",
      lostNote: null,
      closedAt: new Date("2026-06-10T10:00:00Z"),
    });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      status: "contacted",
      lostReason: "competitor",
      firstContactedAt: new Date(),
    });

    await updateConsultationLeadStatus(
      "lead-1",
      { status: "contacted" },
      expertAccess,
    );

    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      status: "contacted",
      firstContactedAt: expect.any(Date),
    });
  });
});

describe("bulkUpdateLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestsByIds.mockResolvedValue([
      baseRow,
      { ...baseRow, id: "lead-2" },
    ]);
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      status: "contacted",
    });
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("requires admin access", async () => {
    await expect(
      bulkUpdateLeads(
        { ids: ["lead-1", "lead-2"], status: "contacted" },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("updates multiple leads for admin", async () => {
    const result = await bulkUpdateLeads(
      { ids: ["lead-1", "lead-2"], status: "contacted" },
      adminAccess,
    );

    expect(result.updated).toBe(2);
    expect(repoMock.findConsultationRequestsByIds).toHaveBeenCalledWith([
      "lead-1",
      "lead-2",
    ]);
    expect(repoMock.updateConsultationLead).toHaveBeenCalledTimes(2);
    expect(repoMock.createLeadActivity).toHaveBeenCalledTimes(2);
  });

  it("sets firstContactedAt when bulk status moves to contacted", async () => {
    await bulkUpdateLeads(
      { ids: ["lead-1"], status: "contacted" },
      adminAccess,
    );

    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      status: "contacted",
      firstContactedAt: expect.any(Date),
    });
  });

  it("sets firstContactedAt when status moves to meeting_scheduled", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      status: "meeting_scheduled",
      firstContactedAt: new Date(),
    });

    await updateConsultationLeadStatus(
      "lead-1",
      { status: "meeting_scheduled" },
      expertAccess,
    );

    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      status: "meeting_scheduled",
      firstContactedAt: expect.any(Date),
    });
  });

  it("bulk assigns leads to expert", async () => {
    staffRepoMock.findStaffUserById.mockImplementation(async (id: string) => {
      if (id === "expert-1") {
        return { id: "expert-1", name: "Expert User", role: "sales_expert", isActive: true };
      }
      if (id === "expert-2") {
        return { id: "expert-2", name: "Other Expert", role: "sales_expert", isActive: true };
      }
      return null;
    });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
    });

    const result = await bulkUpdateLeads(
      { ids: ["lead-1", "lead-2"], assignedToId: "expert-2" },
      adminAccess,
    );

    expect(result.updated).toBe(2);
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      assignedToId: "expert-2",
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "assignment_change",
        detail: serializeAssignmentChangeDetail({
          fromId: "expert-1",
          toId: "expert-2",
          fromName: "Expert User",
          toName: "Other Expert",
        }),
      }),
    );
  });

  it("skips leads when no status or assignment change requested", async () => {
    const result = await bulkUpdateLeads({ ids: ["lead-1"] }, adminAccess);

    expect(result.updated).toBe(0);
    expect(repoMock.updateConsultationLead).not.toHaveBeenCalled();
  });
});

describe("transferLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
      assignedTo: { id: "expert-2", name: "Other Expert" },
    });
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
    repoMock.addConsultationNote.mockResolvedValue({
      id: "note-1",
      body: "انتقال: حجم کار — نیاز به تمرکز روی لیدهای داغ",
      createdAt: new Date(),
      staffUser: { name: "Expert User" },
    });
    leadAssignmentMock.notifyLeadTransferToExpert.mockResolvedValue(undefined);
    staffRepoMock.findStaffUserById.mockImplementation(async (id: string) => {
      if (id === "expert-1") {
        return {
          id: "expert-1",
          name: "Expert User",
          role: "sales_expert",
          isActive: true,
        };
      }
      if (id === "expert-2") {
        return {
          id: "expert-2",
          name: "Other Expert",
          role: "sales_expert",
          isActive: true,
        };
      }
      return null;
    });
  });

  it("allows owner expert to transfer with reason and note", async () => {
    const result = await transferLead(
      "lead-1",
      {
        toStaffUserId: "expert-2",
        reason: "workload",
        note: "نیاز به تمرکز روی لیدهای داغ دارم",
      },
      expertAccess,
    );

    expect(result.assignedToId).toBe("expert-2");
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      assignedToId: "expert-2",
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "assignment_change",
      detail: serializeAssignmentChangeDetail({
        fromId: "expert-1",
        toId: "expert-2",
        fromName: "Expert User",
        toName: "Other Expert",
        reason: "workload",
      }),
    });
    expect(repoMock.addConsultationNote).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationRequestId: "lead-1",
        body: expect.stringContaining("انتقال: حجم کار"),
      }),
    );
    expect(leadAssignmentMock.notifyLeadTransferToExpert).toHaveBeenCalledWith({
      leadId: "lead-1",
      leadName: "Lead One",
      toStaffUserId: "expert-2",
      fromName: "Expert User",
    });
  });

  it("allows admin to transfer any lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: null,
      assignedTo: null,
    });

    await transferLead(
      "lead-1",
      {
        toStaffUserId: "expert-2",
        reason: "expertise",
        note: "این لید به تخصص فروش سازمانی نیاز دارد",
      },
      adminAccess,
    );

    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith("lead-1", {
      assignedToId: "expert-2",
    });
    expect(leadAssignmentMock.notifyLeadTransferToExpert).toHaveBeenCalled();
  });

  it("forbids expert from transferring a lead they do not own", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
      assignedTo: { id: "expert-2", name: "Other Expert" },
    });

    await expect(
      transferLead(
        "lead-1",
        {
          toStaffUserId: "expert-1",
          reason: "workload",
          note: "نیاز به تمرکز روی لیدهای داغ دارم",
        },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects self-transfer for expert", async () => {
    await expect(
      transferLead(
        "lead-1",
        {
          toStaffUserId: "expert-1",
          reason: "workload",
          note: "نیاز به تمرکز روی لیدهای داغ دارم",
        },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects inactive or non-expert destination", async () => {
    staffRepoMock.findStaffUserById.mockResolvedValue({
      id: "expert-2",
      name: "Other Expert",
      role: "sales_expert",
      isActive: false,
    });

    await expect(
      transferLead(
        "lead-1",
        {
          toStaffUserId: "expert-2",
          reason: "leave",
          note: "تا هفته بعد در مرخصی هستم لطفا پیگیری کنید",
        },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

describe("claimLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: null,
      assignedTo: null,
    });
    repoMock.claimLeadIfUnassignedUnderCapacity.mockResolvedValue("ok");
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
    staffRepoMock.findStaffUserById.mockResolvedValue({
      id: "expert-1",
      name: "Expert User",
      role: "sales_expert",
      isActive: true,
    });
  });

  it("claims unassigned lead for the expert and records activity", async () => {
    repoMock.findConsultationRequestById
      .mockResolvedValueOnce({
        ...baseRow,
        assignedToId: null,
        assignedTo: null,
      })
      .mockResolvedValueOnce({
        ...baseRow,
        assignedToId: "expert-1",
        assignedTo: { id: "expert-1", name: "Expert User" },
      });

    const result = await claimLead("lead-1", expertAccess);

    expect(result.assignedToId).toBe("expert-1");
    expect(repoMock.claimLeadIfUnassignedUnderCapacity).toHaveBeenCalledWith(
      "lead-1",
      "expert-1",
      30,
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "assignment_change",
      detail: serializeAssignmentChangeDetail({
        fromId: null,
        toId: "expert-1",
        fromName: null,
        toName: "Expert User",
      }),
    });
  });

  it("rejects claim when lead is already assigned", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);

    await expect(claimLead("lead-1", expertAccess)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    expect(repoMock.claimLeadIfUnassignedUnderCapacity).not.toHaveBeenCalled();
  });

  it("rejects claim when another expert wins the race", async () => {
    repoMock.claimLeadIfUnassignedUnderCapacity.mockResolvedValue(
      "already_assigned",
    );

    await expect(claimLead("lead-1", expertAccess)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("rejects claim when expert is at capacity", async () => {
    repoMock.claimLeadIfUnassignedUnderCapacity.mockResolvedValue("at_capacity");

    await expect(claimLead("lead-1", expertAccess)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("forbids admin-only sessions from claiming", async () => {
    await expect(claimLead("lead-1", adminAccess)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("forbids mutating an unassigned lead without claim", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: null,
      assignedTo: null,
    });

    await expect(
      updateConsultationLeadStatus(
        "lead-1",
        { status: "contacted" },
        expertAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("logCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    repoMock.createLeadCallLog.mockResolvedValue({ id: "call-1" });
    repoMock.updateConsultationLead.mockResolvedValue({
      ...baseRow,
      lastCallOutcome: "no_answer",
      lastCalledAt: new Date("2026-07-28T10:00:00Z"),
    });
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("creates call log, updates lastCall fields, and records activity", async () => {
    const result = await logCall(
      "lead-1",
      { outcome: "no_answer", note: "دو بار زنگ زدم" },
      expertAccess,
    );

    expect(result.lastCallOutcome).toBe("no_answer");
    expect(result.lastCallOutcomeLabel).toBe("بدون پاسخ");
    expect(repoMock.createLeadCallLog).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      outcome: "no_answer",
      note: "دو بار زنگ زدم",
    });
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({
        lastCallOutcome: "no_answer",
        lastCalledAt: expect.any(Date),
      }),
    );
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "call_logged",
      detail: serializeCallLoggedDetail("no_answer", "دو بار زنگ زدم"),
    });
  });

  it("allows admin to log a call without changing status", async () => {
    await logCall("lead-1", { outcome: "busy" }, adminAccess);

    expect(repoMock.createLeadCallLog).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "admin-1",
      outcome: "busy",
      note: null,
    });
    expect(repoMock.updateConsultationLead).toHaveBeenCalledWith(
      "lead-1",
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });

  it("forbids expert from logging a call on another expert's lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: "expert-2",
      assignedTo: { id: "expert-2", name: "Other Expert" },
    });

    await expect(
      logCall("lead-1", { outcome: "no_answer" }, expertAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("createManualLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.createManualConsultationRequest.mockResolvedValue(baseRow);
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("requires admin access", async () => {
    await expect(
      createManualLead({ name: "Manual Lead", phone: "09120000001" }, expertAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("creates lead and activity for admin", async () => {
    const result = await createManualLead(
      { name: "Manual Lead", phone: "09120000001" },
      adminAccess,
    );

    expect(result.id).toBe("lead-1");
    expect(repoMock.createManualConsultationRequest).toHaveBeenCalledWith({
      name: "Manual Lead",
      phone: "09120000001",
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "admin-1",
      type: "created",
      detail: "manual",
    });
  });
});

describe("exportLeadsToCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findAllConsultationRequests.mockResolvedValue([baseRow]);
  });

  it("requires admin access", async () => {
    await expect(
      exportLeadsToCsv({ page: 1, pageSize: 20 }, expertAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("returns UTF-8 BOM CSV for admin", async () => {
    const csv = await exportLeadsToCsv({ page: 1, pageSize: 20 }, adminAccess);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("نام");
    expect(csv).toContain("Lead One");
  });
});

describe("addLeadNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    repoMock.addConsultationNote.mockResolvedValue({
      id: "note-1",
      body: "Called customer",
      createdAt: new Date("2026-06-02T10:00:00Z"),
      staffUser: { name: "Expert User" },
    });
    repoMock.createLeadActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("adds note for assigned expert", async () => {
    const note = await addLeadNote("lead-1", "Called customer", expertAccess);

    expect(note.body).toBe("Called customer");
    expect(note.authorName).toBe("Expert User");
    expect(repoMock.addConsultationNote).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      body: "Called customer",
    });
    expect(repoMock.createLeadActivity).toHaveBeenCalledWith({
      consultationRequestId: "lead-1",
      staffUserId: "expert-1",
      type: "note_added",
      detail: "Called customer",
    });
  });

  it("requires staff user id in session", async () => {
    await expect(
      addLeadNote("lead-1", "Note", {
        adminSession: { role: "admin" },
        salesExpertSession: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("getExpertDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.countConsultationRequests.mockResolvedValue(5);
    repoMock.countLeadsNeedingFollowUp.mockResolvedValue(2);
    repoMock.countClosedLeadsSince.mockResolvedValue(1);
    repoMock.findLeadsNeedingFollowUp.mockResolvedValue([baseRow]);
  });

  it("returns KPI counts and follow-up rows", async () => {
    const dashboard = await getExpertDashboard("expert-1");

    expect(dashboard.kpis.assignedTotal).toBe(5);
    expect(dashboard.kpis.followUpDue).toBe(2);
    expect(dashboard.kpis.closedThisMonth).toBe(1);
    expect(dashboard.todayFollowUps).toHaveLength(1);
    expect(dashboard.todayFollowUps[0]?.detailUrl).toBe(
      "/expert/consultations/lead-1",
    );
  });
});
