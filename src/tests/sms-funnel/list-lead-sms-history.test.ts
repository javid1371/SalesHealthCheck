import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  smsMessage: { findMany: vi.fn() },
  funnelEnrollment: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { listLeadSmsHistory } from "@/modules/sms-funnel/funnel.repository";

describe("listLeadSmsHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.smsMessage.findMany.mockResolvedValue([]);
    dbMock.funnelEnrollment.findMany.mockResolvedValue([]);
  });

  it("returns empty lists when phones and session are absent", async () => {
    const result = await listLeadSmsHistory({
      phones: [],
      assessmentSessionId: null,
    });

    expect(result).toEqual({ messages: [], activeEnrollments: [] });
    expect(dbMock.smsMessage.findMany).not.toHaveBeenCalled();
    expect(dbMock.funnelEnrollment.findMany).not.toHaveBeenCalled();
  });

  it("queries by phone union and assessment enrollment", async () => {
    await listLeadSmsHistory({
      phones: ["09120000001", "09120000002"],
      assessmentSessionId: "assessment-1",
      limit: 20,
    });

    expect(dbMock.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { phone: { in: ["09120000001", "09120000002"] } },
            { enrollment: { assessmentSessionId: "assessment-1" } },
          ],
        },
        take: 20,
      }),
    );
    expect(dbMock.funnelEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "active",
          OR: [
            { assessmentSessionId: "assessment-1" },
            {
              smsMessages: {
                some: { phone: { in: ["09120000001", "09120000002"] } },
              },
            },
          ],
        },
      }),
    );
  });

  it("dedupes phones and ignores blanks", async () => {
    await listLeadSmsHistory({
      phones: [" 09120000001 ", "09120000001", "", "  "],
      assessmentSessionId: null,
    });

    expect(dbMock.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ phone: { in: ["09120000001"] } }],
        },
      }),
    );
  });
});
