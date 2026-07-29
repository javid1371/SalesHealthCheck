import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  assessmentSession: {
    findMany: vi.fn(),
  },
  consultationRequest: {
    findUnique: vi.fn(),
  },
}));

const repoMock = vi.hoisted(() => ({
  ASSESSMENT_PIPELINE_STATUSES: [
    "assessment_in_progress",
    "assessment_incomplete",
    "assessment_completed",
  ],
  createConsultationRequest: vi.fn(),
  deleteConsultationRequestsByIds: vi.fn(),
  findConsultationRequestsByUserId: vi.fn(),
  updateLeadAssessmentBinding: vi.fn(),
}));

const assignmentMock = vi.hoisted(() => ({
  finalizeNewLead: vi.fn(),
}));

const configMock = vi.hoisted(() => ({
  getLeadSettings: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/consultation/lead-assignment.service", () => assignmentMock);
vi.mock("@/modules/consultation/lead-config.service", () => configMock);

describe("lead-backfill per-user reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.getLeadSettings.mockResolvedValue({
      assessmentIncompleteAfterHours: 24,
      autoAssignEnabled: true,
      autoAssignExcludeStaffIds: [],
      pauseSystemLeadCreation: false,
    });
    dbMock.assessmentSession.findMany.mockResolvedValue([]);
    repoMock.findConsultationRequestsByUserId.mockResolvedValue([]);
    repoMock.deleteConsultationRequestsByIds.mockResolvedValue({ count: 0 });
  });

  it("maps completed/abandoned/stale/active assessments to lead statuses", async () => {
    const { resolveBackfillLeadStatus } = await import(
      "@/modules/consultation/lead-backfill.service"
    );

    const now = new Date("2026-07-27T12:00:00.000Z");
    const stale = new Date("2026-07-20T12:00:00.000Z");
    const fresh = new Date("2026-07-27T11:00:00.000Z");

    expect(
      resolveBackfillLeadStatus(
        {
          status: "completed",
          updatedAt: now,
          startedAt: now,
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_completed");

    expect(
      resolveBackfillLeadStatus(
        {
          status: "abandoned",
          updatedAt: now,
          startedAt: now,
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_incomplete");

    expect(
      resolveBackfillLeadStatus(
        {
          status: "in_progress",
          updatedAt: stale,
          startedAt: stale,
          answers: [{ answeredAt: stale }],
        },
        24,
        now,
      ),
    ).toBe("assessment_incomplete");

    expect(
      resolveBackfillLeadStatus(
        {
          status: "started",
          updatedAt: fresh,
          startedAt: fresh,
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_in_progress");
  });

  it("pickCanonicalLead prefers CRM status over pipeline duplicates", async () => {
    const { pickCanonicalLead } = await import(
      "@/modules/consultation/lead-backfill.service"
    );

    const keeper = pickCanonicalLead([
      {
        id: "pipeline",
        status: "assessment_completed" as const,
        assignedToId: "expert-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { leadActivities: 5, consultationNotes: 1 },
      },
      {
        id: "crm",
        status: "new" as const,
        assignedToId: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        _count: { leadActivities: 0, consultationNotes: 0 },
      },
    ]);

    expect(keeper.id).toBe("crm");
  });

  it("creates one lead from the latest assessment per user", async () => {
    dbMock.assessmentSession.findMany.mockResolvedValue([
      {
        id: "assessment-new",
        userId: "user-1",
        status: "completed",
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
        startedAt: new Date("2026-07-02T00:00:00.000Z"),
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
        user: { name: "User One", phone: "09121111111", email: null },
        organization: { businessName: "Biz One" },
        report: { id: "report-2" },
        answers: [],
      },
      {
        id: "assessment-old",
        userId: "user-1",
        status: "in_progress",
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        startedAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        user: { name: "User One", phone: "09121111111", email: null },
        organization: { businessName: "Biz One" },
        report: null,
        answers: [],
      },
    ]);
    repoMock.createConsultationRequest.mockResolvedValue({ id: "lead-1" });
    dbMock.consultationRequest.findUnique.mockResolvedValue({
      assignedToId: "expert-1",
    });

    const { backfillAssessmentLeads } = await import(
      "@/modules/consultation/lead-backfill.service"
    );

    const result = await backfillAssessmentLeads({ group: "all" });

    expect(result.eligible).toBe(1);
    expect(result.created).toBe(1);
    expect(repoMock.createConsultationRequest).toHaveBeenCalledTimes(1);
    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentSessionId: "assessment-new",
        reportId: "report-2",
        status: "assessment_completed",
      }),
    );
  });

  it("dedupes multiple leads for one user and keeps CRM status", async () => {
    dbMock.assessmentSession.findMany.mockResolvedValue([
      {
        id: "assessment-latest",
        userId: "user-1",
        status: "completed",
        updatedAt: new Date(),
        startedAt: new Date(),
        createdAt: new Date(),
        user: { name: "User", phone: "09121111111", email: null },
        organization: { businessName: "Biz" },
        report: { id: "report-1" },
        answers: [],
      },
    ]);
    repoMock.findConsultationRequestsByUserId.mockResolvedValue([
      {
        id: "lead-pipeline",
        status: "assessment_incomplete",
        assignedToId: "expert-1",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        _count: { leadActivities: 0, consultationNotes: 0 },
      },
      {
        id: "lead-crm",
        status: "contacted",
        assignedToId: "expert-2",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        _count: { leadActivities: 2, consultationNotes: 1 },
      },
    ]);
    repoMock.deleteConsultationRequestsByIds.mockResolvedValue({ count: 1 });

    const { backfillAssessmentLeads } = await import(
      "@/modules/consultation/lead-backfill.service"
    );

    const result = await backfillAssessmentLeads({ group: "all" });

    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(1);
    expect(repoMock.updateLeadAssessmentBinding).toHaveBeenCalledWith(
      "lead-crm",
      expect.objectContaining({
        assessmentSessionId: "assessment-latest",
        status: "contacted",
      }),
    );
    expect(repoMock.deleteConsultationRequestsByIds).toHaveBeenCalledWith([
      "lead-pipeline",
    ]);
  });
});
