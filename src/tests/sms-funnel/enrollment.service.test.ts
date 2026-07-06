import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceStepDefinition } from "@/modules/sms-funnel/sequences";

vi.mock("@/lib/env", () => ({
  env: {
    smsFunnelEnabled: true,
    smsQuietHoursStart: 9,
    smsQuietHoursEnd: 21,
  },
}));

const mockIsFunnelEnabledFromSettings = vi.fn();
const mockGetFunnelSettings = vi.fn();
const mockGetResolvedSequence = vi.fn();

vi.mock("@/modules/sms-funnel/funnel-config.service", () => ({
  isFunnelEnabledFromSettings: (...args: unknown[]) =>
    mockIsFunnelEnabledFromSettings(...args),
  getFunnelSettings: (...args: unknown[]) => mockGetFunnelSettings(...args),
  getResolvedSequence: (...args: unknown[]) => mockGetResolvedSequence(...args),
}));

const mockFindUserPhone = vi.fn();
const mockUpsertFunnelEnrollment = vi.fn();
const mockFindSmsMessageByDedupeKey = vi.fn();
const mockHasUserSmsForStep = vi.fn();
const mockCreatePendingSmsMessage = vi.fn();
const mockStopEnrollmentsForUser = vi.fn();

vi.mock("@/modules/sms-funnel/funnel.repository", () => ({
  findUserPhone: (...args: unknown[]) => mockFindUserPhone(...args),
  upsertFunnelEnrollment: (...args: unknown[]) =>
    mockUpsertFunnelEnrollment(...args),
  findSmsMessageByDedupeKey: (...args: unknown[]) =>
    mockFindSmsMessageByDedupeKey(...args),
  hasUserSmsForStep: (...args: unknown[]) => mockHasUserSmsForStep(...args),
  createPendingSmsMessage: (...args: unknown[]) =>
    mockCreatePendingSmsMessage(...args),
  stopEnrollmentsForUser: (...args: unknown[]) =>
    mockStopEnrollmentsForUser(...args),
}));

const mockEnqueueSmsFunnelJob = vi.fn();
const mockGetSmsFunnelQueue = vi.fn();

vi.mock("@/modules/sms-funnel/sms-funnel.queue", () => ({
  enqueueSmsFunnelJob: (...args: unknown[]) => mockEnqueueSmsFunnelJob(...args),
  getSmsFunnelQueue: (...args: unknown[]) => mockGetSmsFunnelQueue(...args),
}));

vi.mock("@/modules/sms-funnel/sms-funnel.processor", () => ({
  processSmsFunnelJob: vi.fn(),
}));

const START_STEPS: SequenceStepDefinition[] = [
  {
    stepKey: "S1-1",
    delayMs: 0,
    linkPurpose: "start",
    body: "step one",
  },
  {
    stepKey: "S1-2",
    delayMs: 60_000,
    linkPurpose: "start",
    body: "step two",
  },
];

const USER_ID = "user-1";
const ENROLLMENT_ID = "enr-1";
const PHONE = "09120000000";

describe("enrollAndSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFunnelEnabledFromSettings.mockResolvedValue(true);
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 9,
      quietHoursEnd: 21,
    });
    mockFindUserPhone.mockResolvedValue(PHONE);
    mockUpsertFunnelEnrollment.mockResolvedValue({ id: ENROLLMENT_ID });
    mockFindSmsMessageByDedupeKey.mockResolvedValue(null);
    mockHasUserSmsForStep.mockResolvedValue(false);
    mockCreatePendingSmsMessage.mockImplementation(async (input) => ({
      id: `msg-${input.stepKey}`,
      ...input,
    }));
    mockGetSmsFunnelQueue.mockResolvedValue({ add: vi.fn() });
    mockGetResolvedSequence.mockResolvedValue({ key: "seq_start", steps: START_STEPS });
  });

  it("returns early when funnel is disabled", async () => {
    mockIsFunnelEnabledFromSettings.mockResolvedValue(false);

    const { enrollAndSchedule } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await enrollAndSchedule("seq_start", { userId: USER_ID });

    expect(mockFindUserPhone).not.toHaveBeenCalled();
    expect(mockUpsertFunnelEnrollment).not.toHaveBeenCalled();
  });

  it("returns early when user has no phone", async () => {
    mockFindUserPhone.mockResolvedValue(null);

    const { enrollAndSchedule } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await enrollAndSchedule("seq_start", { userId: USER_ID });

    expect(mockUpsertFunnelEnrollment).not.toHaveBeenCalled();
    expect(mockCreatePendingSmsMessage).not.toHaveBeenCalled();
  });

  it("skips steps that already exist by enrollment dedupe key", async () => {
    mockFindSmsMessageByDedupeKey.mockImplementation(async (dedupeKey: string) =>
      dedupeKey.includes("S1-1") ? { id: "existing" } : null,
    );

    const { enrollAndSchedule } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await enrollAndSchedule("seq_start", { userId: USER_ID });

    expect(mockCreatePendingSmsMessage).toHaveBeenCalledTimes(1);
    expect(mockCreatePendingSmsMessage).toHaveBeenCalledWith(
      expect.objectContaining({ stepKey: "S1-2" }),
    );
    expect(mockHasUserSmsForStep).toHaveBeenCalledTimes(1);
  });

  it("skips steps the user already received in another enrollment", async () => {
    mockHasUserSmsForStep.mockImplementation(
      async (_userId, _sequenceKey, stepKey) => stepKey === "S1-1",
    );

    const { enrollAndSchedule } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await enrollAndSchedule("seq_start", { userId: USER_ID });

    expect(mockHasUserSmsForStep).toHaveBeenCalledWith(
      USER_ID,
      "seq_start",
      "S1-1",
    );
    expect(mockCreatePendingSmsMessage).toHaveBeenCalledTimes(1);
    expect(mockCreatePendingSmsMessage).toHaveBeenCalledWith(
      expect.objectContaining({ stepKey: "S1-2" }),
    );
  });

  it("creates pending SMS and enqueues jobs for new steps", async () => {
    const { enrollAndSchedule } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await enrollAndSchedule("seq_start", { userId: USER_ID });

    expect(mockUpsertFunnelEnrollment).toHaveBeenCalledWith({
      userId: USER_ID,
      assessmentSessionId: undefined,
      sequenceKey: "seq_start",
      scoreBand: undefined,
    });
    expect(mockCreatePendingSmsMessage).toHaveBeenCalledTimes(2);
    expect(mockEnqueueSmsFunnelJob).toHaveBeenCalledTimes(2);
  });
});

describe("onAssessmentStarted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopEnrollmentsForUser.mockResolvedValue({ count: 1 });
  });

  it("stops all nurture sequences for the user without session filter", async () => {
    const { onAssessmentStarted } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await onAssessmentStarted(USER_ID, "session-new");

    expect(mockStopEnrollmentsForUser).toHaveBeenCalledOnce();
    expect(mockStopEnrollmentsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      sequenceKeys: [
        "seq_start",
        "seq_incomplete",
        "seq_report_ready",
        "seq_nurture",
        "seq_form_abandon",
      ],
      status: "stopped",
    });
    const call = mockStopEnrollmentsForUser.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(call).not.toHaveProperty("assessmentSessionId");
  });
});

describe("onAssessmentInProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopEnrollmentsForUser.mockResolvedValue({ count: 1 });
    mockIsFunnelEnabledFromSettings.mockResolvedValue(true);
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 9,
      quietHoursEnd: 21,
    });
    mockFindUserPhone.mockResolvedValue(PHONE);
    mockUpsertFunnelEnrollment.mockResolvedValue({ id: ENROLLMENT_ID });
    mockFindSmsMessageByDedupeKey.mockResolvedValue(null);
    mockHasUserSmsForStep.mockResolvedValue(false);
    mockCreatePendingSmsMessage.mockResolvedValue({ id: "msg-1" });
    mockGetSmsFunnelQueue.mockResolvedValue({ add: vi.fn() });
    mockGetResolvedSequence.mockResolvedValue({
      key: "seq_incomplete",
      steps: [START_STEPS[0]!],
    });
  });

  it("stops seq_start and enrolls seq_incomplete for the session", async () => {
    const { onAssessmentInProgress } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await onAssessmentInProgress(USER_ID, "session-1");

    expect(mockStopEnrollmentsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      sequenceKeys: ["seq_start"],
      status: "stopped",
    });
    expect(mockUpsertFunnelEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        assessmentSessionId: "session-1",
        sequenceKey: "seq_incomplete",
      }),
    );
  });
});

describe("onAssessmentCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopEnrollmentsForUser.mockResolvedValue({ count: 1 });
    mockIsFunnelEnabledFromSettings.mockResolvedValue(true);
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 9,
      quietHoursEnd: 21,
    });
    mockFindUserPhone.mockResolvedValue(PHONE);
    mockUpsertFunnelEnrollment.mockResolvedValue({ id: ENROLLMENT_ID });
    mockFindSmsMessageByDedupeKey.mockResolvedValue(null);
    mockHasUserSmsForStep.mockResolvedValue(false);
    mockCreatePendingSmsMessage.mockResolvedValue({ id: "msg-1" });
    mockGetSmsFunnelQueue.mockResolvedValue({ add: vi.fn() });
    mockGetResolvedSequence.mockResolvedValue({
      key: "seq_report_ready",
      steps: [START_STEPS[0]!],
    });
  });

  it("stops incomplete/start for the session and enrolls report_ready", async () => {
    const { onAssessmentCompleted } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await onAssessmentCompleted({
      userId: USER_ID,
      assessmentSessionId: "session-1",
      scoreBand: "medium",
    });

    expect(mockStopEnrollmentsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      assessmentSessionId: "session-1",
      sequenceKeys: ["seq_incomplete", "seq_start"],
      status: "stopped",
    });
    expect(mockUpsertFunnelEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        sequenceKey: "seq_report_ready",
        scoreBand: "medium",
      }),
    );
  });
});

describe("onConsultationSubmitted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopEnrollmentsForUser.mockResolvedValue({ count: 1 });
    mockIsFunnelEnabledFromSettings.mockResolvedValue(true);
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 9,
      quietHoursEnd: 21,
    });
    mockFindUserPhone.mockResolvedValue(PHONE);
    mockUpsertFunnelEnrollment.mockResolvedValue({ id: ENROLLMENT_ID });
    mockFindSmsMessageByDedupeKey.mockResolvedValue(null);
    mockHasUserSmsForStep.mockResolvedValue(false);
    mockCreatePendingSmsMessage.mockResolvedValue({ id: "msg-1" });
    mockGetSmsFunnelQueue.mockResolvedValue({ add: vi.fn() });
    mockGetResolvedSequence.mockResolvedValue({
      key: "seq_call_scheduled",
      steps: [START_STEPS[0]!],
    });
  });

  it("marks nurture as converted and enrolls call_scheduled", async () => {
    const { onConsultationSubmitted } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await onConsultationSubmitted(USER_ID, "session-1");

    expect(mockStopEnrollmentsForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      assessmentSessionId: "session-1",
      sequenceKeys: [
        "seq_start",
        "seq_incomplete",
        "seq_report_ready",
        "seq_nurture",
        "seq_form_abandon",
      ],
      status: "converted",
    });
    expect(mockUpsertFunnelEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        sequenceKey: "seq_call_scheduled",
        assessmentSessionId: "session-1",
      }),
    );
  });
});

describe("onPhoneVerified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFunnelEnabledFromSettings.mockResolvedValue(true);
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 9,
      quietHoursEnd: 21,
    });
    mockFindUserPhone.mockResolvedValue(PHONE);
    mockUpsertFunnelEnrollment.mockResolvedValue({ id: ENROLLMENT_ID });
    mockFindSmsMessageByDedupeKey.mockResolvedValue(null);
    mockHasUserSmsForStep.mockResolvedValue(false);
    mockCreatePendingSmsMessage.mockResolvedValue({ id: "msg-1" });
    mockGetSmsFunnelQueue.mockResolvedValue({ add: vi.fn() });
    mockGetResolvedSequence.mockResolvedValue({ key: "seq_start", steps: START_STEPS });
  });

  it("enrolls seq_start for the verified user", async () => {
    const { onPhoneVerified } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await onPhoneVerified(USER_ID);

    expect(mockUpsertFunnelEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        sequenceKey: "seq_start",
      }),
    );
  });
});
