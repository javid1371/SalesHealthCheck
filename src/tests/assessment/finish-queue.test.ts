import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdd = vi.fn().mockResolvedValue({ id: "finish-a1" });
const mockGetJob = vi.fn().mockResolvedValue(null);
const mockGetJobCounts = vi.fn().mockResolvedValue({
  waiting: 0,
  active: 0,
  delayed: 0,
  prioritized: 0,
  paused: 0,
});
const mockGetBullMqConnection = vi.hoisted(() =>
  vi.fn((): { url: string } | null => ({ url: "redis://localhost:6379" })),
);

vi.mock("@/lib/env", () => ({
  env: {
    asyncFinishEnabled: true,
    finishWorkerConcurrency: 3,
  },
}));

vi.mock("@/lib/redis", () => ({
  getBullMqConnection: () => mockGetBullMqConnection(),
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockAdd;
    getJob = mockGetJob;
    getJobCounts = mockGetJobCounts;
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("finish-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetBullMqConnection.mockReturnValue({ url: "redis://localhost:6379" });
    mockGetJob.mockResolvedValue(null);
    mockAdd.mockResolvedValue({ id: "finish-a1" });
    mockGetJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      delayed: 0,
      prioritized: 0,
      paused: 0,
    });
  });

  it("toFinishJobId is colon-free", async () => {
    const { toFinishJobId } = await import(
      "@/modules/assessment/finish-queue.types"
    );
    expect(toFinishJobId("abc-123")).toBe("finish-abc-123");
    expect(toFinishJobId("abc-123")).not.toContain(":");
  });

  it("enqueueFinishJob adds a finish job with stable jobId", async () => {
    const { enqueueFinishJob, closeFinishQueueForTests } = await import(
      "@/modules/assessment/finish-queue.service"
    );

    const jobId = await enqueueFinishJob({ assessmentId: "a1" });

    expect(jobId).toBe("finish-a1");
    expect(mockAdd).toHaveBeenCalledWith(
      "finish",
      { assessmentId: "a1" },
      expect.objectContaining({ jobId: "finish-a1" }),
    );

    await closeFinishQueueForTests();
  });

  it("enqueueFinishJob reuses an in-flight job", async () => {
    mockGetJob.mockResolvedValue({
      id: "finish-a1",
      getState: vi.fn().mockResolvedValue("active"),
      remove: vi.fn(),
    });

    const { enqueueFinishJob, closeFinishQueueForTests } = await import(
      "@/modules/assessment/finish-queue.service"
    );

    const jobId = await enqueueFinishJob({ assessmentId: "a1" });

    expect(jobId).toBe("finish-a1");
    expect(mockAdd).not.toHaveBeenCalled();

    await closeFinishQueueForTests();
  });

  it("enqueueFinishJob throws when Redis is unavailable", async () => {
    mockGetBullMqConnection.mockReturnValue(null);

    const { enqueueFinishJob, closeFinishQueueForTests } = await import(
      "@/modules/assessment/finish-queue.service"
    );

    await expect(enqueueFinishJob({ assessmentId: "a1" })).rejects.toMatchObject(
      {
        code: "finish_queue_unavailable",
        status: 503,
      },
    );

    await closeFinishQueueForTests();
  });

  it("getFinishQueueDepth sums waiting/active/delayed/prioritized/paused", async () => {
    mockGetJobCounts.mockResolvedValue({
      waiting: 2,
      active: 1,
      delayed: 3,
      prioritized: 0,
      paused: 1,
    });

    const { getFinishQueueDepth, closeFinishQueueForTests } = await import(
      "@/modules/assessment/finish-queue.service"
    );

    await expect(getFinishQueueDepth()).resolves.toBe(7);
    expect(mockGetJobCounts).toHaveBeenCalledWith(
      "waiting",
      "active",
      "delayed",
      "prioritized",
      "paused",
    );

    await closeFinishQueueForTests();
  });

  it("getFinishQueueDepth returns null when queue unavailable", async () => {
    mockGetBullMqConnection.mockReturnValue(null);

    const { getFinishQueueDepth, closeFinishQueueForTests } = await import(
      "@/modules/assessment/finish-queue.service"
    );

    await expect(getFinishQueueDepth()).resolves.toBeNull();
    await closeFinishQueueForTests();
  });
});
