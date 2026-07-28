import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  findConsultationRequestById: vi.fn(),
}));

const funnelRepoMock = vi.hoisted(() => ({
  listLeadSmsHistory: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/sms-funnel/funnel.repository", () => funnelRepoMock);

import { getConsultationLeadSmsHistory } from "@/modules/consultation/consultation.service";

const baseRow = {
  id: "lead-1",
  name: "Lead One",
  phone: "09120000001",
  email: null,
  message: null,
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
  assessmentSessionId: "assessment-1",
  reportId: null,
  assignedTo: { id: "expert-1", name: "Expert User" },
  assessmentSession: {
    user: { phone: "09120000002" },
  },
  report: null,
  consultationNotes: [],
  leadActivities: [],
};

const adminAccess = {
  adminSession: {
    role: "admin" as const,
    staffUserId: "admin-1",
    name: "Admin",
  },
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

const otherExpertAccess = {
  adminSession: null,
  salesExpertSession: {
    role: "sales_expert" as const,
    staffUserId: "expert-2",
    name: "Other Expert",
  },
};

describe("getConsultationLeadSmsHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMock.findConsultationRequestById.mockResolvedValue(baseRow);
    funnelRepoMock.listLeadSmsHistory.mockResolvedValue({
      messages: [],
      activeEnrollments: [],
    });
  });

  it("returns empty history without error when no SMS exist", async () => {
    const history = await getConsultationLeadSmsHistory("lead-1", expertAccess);

    expect(history).toEqual({
      activeEnrollments: [],
      messages: [],
    });
    expect(funnelRepoMock.listLeadSmsHistory).toHaveBeenCalledWith({
      phones: ["09120000001", "09120000002"],
      assessmentSessionId: "assessment-1",
    });
  });

  it("allows admin and maps message/enrollment labels", async () => {
    funnelRepoMock.listLeadSmsHistory.mockResolvedValue({
      activeEnrollments: [
        {
          id: "enroll-1",
          sequenceKey: "seq_call_scheduled",
          currentStep: "S6-1",
          status: "active",
          messagesSentCount: 1,
          lastEventAt: new Date("2026-06-02T08:00:00Z"),
        },
      ],
      messages: [
        {
          id: "sms-1",
          phone: "09120000001",
          sequenceKey: "seq_nurture",
          stepKey: "S4-1",
          status: "sent",
          scheduledFor: new Date("2026-06-01T12:00:00Z"),
          sentAt: new Date("2026-06-01T12:05:00Z"),
          createdAt: new Date("2026-06-01T11:00:00Z"),
          error: null,
        },
      ],
    });

    const history = await getConsultationLeadSmsHistory("lead-1", adminAccess);

    expect(history.activeEnrollments).toHaveLength(1);
    expect(history.activeEnrollments[0]).toMatchObject({
      sequenceKey: "seq_call_scheduled",
      sequenceLabel: "تماس ثبت‌شده",
      statusLabel: "فعال",
      currentStep: "S6-1",
    });
    expect(history.messages).toHaveLength(1);
    expect(history.messages[0]).toMatchObject({
      stepKey: "S4-1",
      sequenceLabel: "گزارش دیده — بدون تماس",
      statusLabel: "ارسال‌شده",
      phone: "09120000001",
    });
    expect(history.messages[0]?.sentAt).toBeTruthy();
  });

  it("forbids expert without assignment access", async () => {
    await expect(
      getConsultationLeadSmsHistory("lead-1", otherExpertAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(funnelRepoMock.listLeadSmsHistory).not.toHaveBeenCalled();
  });

  it("returns 404 when lead is missing", async () => {
    repoMock.findConsultationRequestById.mockResolvedValue(null);

    await expect(
      getConsultationLeadSmsHistory("missing", adminAccess),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      getConsultationLeadSmsHistory("lead-1", {
        adminSession: null,
        salesExpertSession: null,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });
});
