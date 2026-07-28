import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockGetJob = vi.fn().mockResolvedValue(null);
const mockGetBullMqConnection = vi.hoisted(() =>
  vi.fn(() => ({ host: "localhost" })),
);

vi.mock("@/lib/env", () => ({
  env: { smsFunnelEnabled: true },
}));

vi.mock("@/lib/redis", () => ({
  getBullMqConnection: (...args: unknown[]) => mockGetBullMqConnection(...args),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockAdd;
    getJob = mockGetJob;
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("sms-funnel.queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetBullMqConnection.mockReturnValue({ host: "localhost" });
    mockGetJob.mockResolvedValue(null);
    mockAdd.mockResolvedValue(undefined);
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

  it("rescheduleSmsFunnelJob removes existing job and enqueues with new delay", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    mockGetJob.mockResolvedValue({ remove });

    const { rescheduleSmsFunnelJob, closeSmsFunnelQueueForTests } = await import(
      "@/modules/sms-funnel/sms-funnel.queue"
    );

    const payload = {
      enrollmentId: "enroll-1",
      sequenceKey: "seq_call_scheduled",
      stepKey: "S6-3",
      dedupeKey: "enroll-1:S6-3",
      smsMessageId: "msg-1",
    };

    await rescheduleSmsFunnelJob(payload, 90_000);

    expect(mockGetJob).toHaveBeenCalledWith("enroll-1__S6-3");
    expect(remove).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledWith(
      "send",
      payload,
      expect.objectContaining({
        jobId: "enroll-1__S6-3",
        delay: 90_000,
      }),
    );

    await closeSmsFunnelQueueForTests();
  });

  it("rescheduleSmsFunnelJob throws when queue is unavailable", async () => {
    mockGetBullMqConnection.mockReturnValue(null);

    const { rescheduleSmsFunnelJob, closeSmsFunnelQueueForTests } = await import(
      "@/modules/sms-funnel/sms-funnel.queue"
    );

    await expect(
      rescheduleSmsFunnelJob(
        {
          enrollmentId: "enroll-1",
          sequenceKey: "seq_call_scheduled",
          stepKey: "S6-3",
          dedupeKey: "enroll-1:S6-3",
          smsMessageId: "msg-1",
        },
        60_000,
      ),
    ).rejects.toThrow(/queue unavailable/);

    expect(mockAdd).not.toHaveBeenCalled();
    await closeSmsFunnelQueueForTests();
  });
});
