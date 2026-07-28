import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindSmsMessageByDedupeKey = vi.hoisted(() => vi.fn());
const mockFindEnrollmentById = vi.hoisted(() => vi.fn());
const mockGetResolvedStep = vi.hoisted(() => vi.fn());
const mockEvaluateSendGuard = vi.hoisted(() => vi.fn());
const mockGetFunnelSettings = vi.hoisted(() => vi.fn());
const mockEnqueueSmsFunnelJob = vi.hoisted(() => vi.fn());
const mockFindUserPhone = vi.hoisted(() => vi.fn());

vi.mock("@/modules/sms-funnel/funnel.repository", () => ({
  findSmsMessageByDedupeKey: (...args: unknown[]) =>
    mockFindSmsMessageByDedupeKey(...args),
  findEnrollmentById: (...args: unknown[]) => mockFindEnrollmentById(...args),
  findUserPhone: (...args: unknown[]) => mockFindUserPhone(...args),
  updateSmsMessageStatus: vi.fn(),
  incrementEnrollmentSentCount: vi.fn(),
  updateEnrollmentStep: vi.fn(),
  createFunnelEvent: vi.fn(),
  stopEnrollmentsForUser: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/funnel-config.service", () => ({
  getResolvedStep: (...args: unknown[]) => mockGetResolvedStep(...args),
  getFunnelSettings: (...args: unknown[]) => mockGetFunnelSettings(...args),
}));

vi.mock("@/modules/sms-funnel/guards", () => ({
  evaluateSendGuard: (...args: unknown[]) => mockEvaluateSendGuard(...args),
}));

vi.mock("@/modules/sms-funnel/sms-funnel.queue", () => ({
  enqueueSmsFunnelJob: (...args: unknown[]) => mockEnqueueSmsFunnelJob(...args),
}));

vi.mock("@/modules/sms-funnel/quiet-hours", () => ({
  nextAllowedSmsSendTime: (date: Date) => date,
}));

vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSenderFromSettings: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/branding", () => ({
  buildBrandedSmsMessage: (body: string) => body,
}));

vi.mock("@/modules/sms-funnel/short-link.service", () => ({
  createTrackedShortLink: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/sequences", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/sms-funnel/sequences")
  >("@/modules/sms-funnel/sequences");
  return {
    ...actual,
    resolveStepBody: () => "body",
    stepIncludesLink: () => false,
  };
});

describe("processSmsFunnelJob schedule guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr-1",
      userId: "user-1",
      assessmentSessionId: "session-1",
      scoreBand: null,
    });
    mockGetResolvedStep.mockResolvedValue({
      stepKey: "S6-3",
      enabled: true,
      body: "reminder",
      linkPurpose: null,
    });
    mockEvaluateSendGuard.mockResolvedValue({ allowed: true });
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 0,
      quietHoursEnd: 24,
    });
    mockFindUserPhone.mockResolvedValue("09120000000");
  });

  it("re-enqueues when DB scheduledFor is still in the future", async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    mockFindSmsMessageByDedupeKey.mockResolvedValue({
      id: "msg-1",
      status: "pending",
      scheduledFor: future,
    });

    const { processSmsFunnelJob } = await import(
      "@/modules/sms-funnel/sms-funnel.processor"
    );

    await processSmsFunnelJob({
      enrollmentId: "enr-1",
      sequenceKey: "seq_call_scheduled",
      stepKey: "S6-3",
      dedupeKey: "enr-1:S6-3",
      smsMessageId: "msg-1",
    });

    expect(mockEnqueueSmsFunnelJob).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "enr-1:S6-3" }),
      expect.any(Number),
    );
    const delayMs = mockEnqueueSmsFunnelJob.mock.calls[0]?.[1] as number;
    expect(delayMs).toBeGreaterThan(60_000);
    expect(mockFindUserPhone).not.toHaveBeenCalled();
  });
});
