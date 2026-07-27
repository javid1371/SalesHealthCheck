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
  createConsultationRequest: vi.fn(),
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

describe("resolveBackfillLeadStatus / backfillAssessmentLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.getLeadSettings.mockResolvedValue({
      assessmentIncompleteAfterHours: 24,
      autoAssignEnabled: true,
      autoAssignExcludeStaffIds: [],
    });
    dbMock.assessmentSession.findMany.mockResolvedValue([]);
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
          id: "a1",
          status: "completed",
          updatedAt: now,
          startedAt: now,
          user: { name: "A", phone: null, email: null },
          organization: { businessName: "Biz" },
          report: { id: "r1" },
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_completed");

    expect(
      resolveBackfillLeadStatus(
        {
          id: "a2",
          status: "abandoned",
          updatedAt: now,
          startedAt: now,
          user: { name: "A", phone: null, email: null },
          organization: { businessName: "Biz" },
          report: null,
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_incomplete");

    expect(
      resolveBackfillLeadStatus(
        {
          id: "a3",
          status: "in_progress",
          updatedAt: stale,
          startedAt: stale,
          user: { name: "A", phone: null, email: null },
          organization: { businessName: "Biz" },
          report: null,
          answers: [{ answeredAt: stale }],
        },
        24,
        now,
      ),
    ).toBe("assessment_incomplete");

    expect(
      resolveBackfillLeadStatus(
        {
          id: "a4",
          status: "started",
          updatedAt: fresh,
          startedAt: fresh,
          user: { name: "A", phone: null, email: null },
          organization: { businessName: "Biz" },
          report: null,
          answers: [],
        },
        24,
        now,
      ),
    ).toBe("assessment_in_progress");
  });

  it("creates and soft-assigns leads for candidates", async () => {
    dbMock.assessmentSession.findMany.mockResolvedValue([
      {
        id: "assessment-1",
        status: "completed",
        updatedAt: new Date(),
        startedAt: new Date(),
        user: { name: "User One", phone: "09121111111", email: null },
        organization: { businessName: "Biz One" },
        report: { id: "report-1" },
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

    expect(result.created).toBe(1);
    expect(result.assigned).toBe(1);
    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentSessionId: "assessment-1",
        reportId: "report-1",
        source: "system",
        status: "assessment_completed",
      }),
    );
    expect(assignmentMock.finalizeNewLead).toHaveBeenCalledWith("lead-1", {
      assessmentSessionId: "assessment-1",
      mode: "immediate",
      notifyExpert: false,
    });
  });

  it("dry-run does not write leads", async () => {
    dbMock.assessmentSession.findMany.mockResolvedValue([
      {
        id: "assessment-1",
        status: "started",
        updatedAt: new Date(),
        startedAt: new Date(),
        user: { name: "User", phone: null, email: null },
        organization: { businessName: "Biz" },
        report: null,
        answers: [],
      },
    ]);

    const { backfillAssessmentLeads } = await import(
      "@/modules/consultation/lead-backfill.service"
    );

    const result = await backfillAssessmentLeads({ dryRun: true });

    expect(result.created).toBe(1);
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(assignmentMock.finalizeNewLead).not.toHaveBeenCalled();
  });
});
