import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

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
  findAllConsultationRequests: vi.fn(),
  findConsultationRequestsByIds: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);

import {
  addLeadNote,
  bulkUpdateLeads,
  createManualLead,
  exportLeadsToCsv,
  getConsultationLeadDetail,
  getExpertDashboard,
  listConsultationRequests,
  updateConsultationLeadStatus,
} from "@/modules/consultation/consultation.service";

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

  it("forbids expert viewing unassigned lead", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue({
      ...baseRow,
      assignedToId: null,
      assignedTo: null,
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

  it("bulk assigns leads to expert", async () => {
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
        detail: "expert-2",
      }),
    );
  });

  it("skips leads when no status or assignment change requested", async () => {
    const result = await bulkUpdateLeads({ ids: ["lead-1"] }, adminAccess);

    expect(result.updated).toBe(0);
    expect(repoMock.updateConsultationLead).not.toHaveBeenCalled();
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
