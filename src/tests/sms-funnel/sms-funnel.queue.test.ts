import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdd = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/env", () => ({
  env: { smsFunnelEnabled: true },
}));

vi.mock("@/lib/redis", () => ({
  getBullMqConnection: vi.fn(() => ({ host: "localhost" })),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockAdd;
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("sms-funnel.queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("toBullMqJobId replaces colons with double underscores", async () => {
    const { toBullMqJobId, buildDedupeKey } = await import(
      "@/modules/sms-funnel/sms-funnel.types"
    );
    const dedupeKey = buildDedupeKey("enroll-abc", "S1-1");
    expect(dedupeKey).toBe("enroll-abc:S1-1");
    expect(toBullMqJobId(dedupeKey)).toBe("enroll-abc__S1-1");
    expect(toBullMqJobId(dedupeKey)).not.toContain(":");
  });

  it("enqueueSmsFunnelJob uses sanitized jobId, not raw dedupeKey", async () => {
    const { enqueueSmsFunnelJob, closeSmsFunnelQueueForTests } = await import(
      "@/modules/sms-funnel/sms-funnel.queue"
    );
    const { buildDedupeKey } = await import(
      "@/modules/sms-funnel/sms-funnel.types"
    );

    const dedupeKey = buildDedupeKey("enroll-xyz", "S2-1");
    const payload = {
      enrollmentId: "enroll-xyz",
      sequenceKey: "seq_start",
      stepKey: "S2-1",
      dedupeKey,
      smsMessageId: "msg-1",
    };

    await enqueueSmsFunnelJob(payload, 0);

    expect(mockAdd).toHaveBeenCalledWith(
      "send",
      payload,
      expect.objectContaining({
        jobId: "enroll-xyz__S2-1",
        delay: 0,
      }),
    );
    expect(mockAdd.mock.calls[0][2].jobId).not.toContain(":");

    await closeSmsFunnelQueueForTests();
  });
});
