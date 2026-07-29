import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: { count: vi.fn() },
  consultationRequest: { count: vi.fn() },
  smsMessage: { count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  countUsersWithConsultation,
  countUsersWithNewConsultation,
  countUnassignedOpenLeads,
  countStalePendingSmsMessages,
} from "@/modules/admin/admin.repository";

const completedWithUserConsultationWhere = {
  assessmentSessions: {
    some: {
      status: "completed",
      consultationRequests: {
        some: {
          source: { in: ["direct", "messenger"] },
        },
      },
    },
  },
};

describe("countUsersWithConsultation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts completers with a direct or messenger request, not system-only leads", async () => {
    dbMock.user.count.mockResolvedValue(7);

    const count = await countUsersWithConsultation();

    expect(dbMock.user.count).toHaveBeenCalledWith({
      where: completedWithUserConsultationWhere,
    });
    expect(count).toBe(7);
  });

  it("shares the same definition for countUsersWithNewConsultation", async () => {
    dbMock.user.count.mockResolvedValue(3);

    const count = await countUsersWithNewConsultation();

    expect(dbMock.user.count).toHaveBeenCalledTimes(1);
    expect(dbMock.user.count).toHaveBeenCalledWith({
      where: completedWithUserConsultationWhere,
    });
    expect(count).toBe(3);
  });

  it("returns zero when only system leads exist (caller-level expectation)", async () => {
    // Repository filter excludes source=system; mock reflects an empty match set.
    dbMock.user.count.mockResolvedValue(0);

    await expect(countUsersWithConsultation()).resolves.toBe(0);
    expect(dbMock.user.count.mock.calls[0]?.[0]).toEqual({
      where: completedWithUserConsultationWhere,
    });
  });
});

describe("ops queue counters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts unassigned open leads across open statuses", async () => {
    dbMock.consultationRequest.count.mockResolvedValue(5);

    await expect(countUnassignedOpenLeads()).resolves.toBe(5);
    expect(dbMock.consultationRequest.count).toHaveBeenCalledWith({
      where: {
        assignedToId: null,
        status: {
          in: [
            "assessment_in_progress",
            "assessment_incomplete",
            "assessment_completed",
            "new",
            "contacted",
            "meeting_scheduled",
            "unreachable",
          ],
        },
      },
    });
  });

  it("counts pending SMS older than the given minutes", async () => {
    dbMock.smsMessage.count.mockResolvedValue(2);

    await expect(countStalePendingSmsMessages(15)).resolves.toBe(2);
    expect(dbMock.smsMessage.count).toHaveBeenCalledWith({
      where: {
        status: "pending",
        scheduledFor: { lt: expect.any(Date) },
      },
    });
  });
});
