import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  funnelEvent: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { countDistinctFunnelActorsByType } from "@/modules/sms-funnel/funnel.repository";

describe("countDistinctFunnelActorsByType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts distinct actors for consultation_submitted by userId, visitorId, and session", async () => {
    dbMock.funnelEvent.findMany.mockResolvedValue([
      {
        userId: "user-1",
        assessmentSessionId: "a-1",
        metadata: null,
      },
      {
        userId: "user-1",
        assessmentSessionId: "a-1",
        metadata: { visitorId: "v-dup" },
      },
      {
        userId: null,
        assessmentSessionId: "a-2",
        metadata: { visitorId: "visitor-2" },
      },
      {
        userId: null,
        assessmentSessionId: "a-3",
        metadata: null,
      },
      {
        userId: null,
        assessmentSessionId: null,
        metadata: {},
      },
    ]);

    const count = await countDistinctFunnelActorsByType(
      "consultation_submitted",
    );

    expect(dbMock.funnelEvent.findMany).toHaveBeenCalledWith({
      where: { type: "consultation_submitted" },
      select: {
        userId: true,
        assessmentSessionId: true,
        metadata: true,
      },
    });
    // u:user-1, v:visitor-2, a:a-3 — empty actor dropped
    expect(count).toBe(3);
  });
});
