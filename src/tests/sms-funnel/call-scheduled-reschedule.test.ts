import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCallScheduledOffsetMs,
  SEQUENCE_KEYS,
} from "@/modules/sms-funnel/sequences";

const MS_HOUR = 60 * 60 * 1000;

const mockFindActiveCallScheduledEnrollment = vi.hoisted(() => vi.fn());
const mockListPendingSmsForEnrollment = vi.hoisted(() => vi.fn());
const mockCancelPendingSmsMessage = vi.hoisted(() => vi.fn());
const mockUpdateSmsMessageScheduledFor = vi.hoisted(() => vi.fn());
const mockGetFunnelSettings = vi.hoisted(() => vi.fn());
const mockRemoveSmsFunnelJob = vi.hoisted(() => vi.fn());
const mockRescheduleSmsFunnelJob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  env: {
    smsFunnelEnabled: true,
    smsQuietHoursStart: 0,
    smsQuietHoursEnd: 24,
  },
}));

vi.mock("@/modules/sms-funnel/funnel.repository", () => ({
  findActiveCallScheduledEnrollment: (...args: unknown[]) =>
    mockFindActiveCallScheduledEnrollment(...args),
  listPendingSmsForEnrollment: (...args: unknown[]) =>
    mockListPendingSmsForEnrollment(...args),
  cancelPendingSmsMessage: (...args: unknown[]) =>
    mockCancelPendingSmsMessage(...args),
  updateSmsMessageScheduledFor: (...args: unknown[]) =>
    mockUpdateSmsMessageScheduledFor(...args),
  createPendingSmsMessage: vi.fn(),
  findSmsMessageByDedupeKey: vi.fn(),
  findUserPhone: vi.fn(),
  hasUserSmsForStep: vi.fn(),
  stopEnrollmentsForUser: vi.fn(),
  upsertFunnelEnrollment: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/funnel-config.service", () => ({
  getFunnelSettings: (...args: unknown[]) => mockGetFunnelSettings(...args),
  getResolvedSequence: vi.fn(),
  isFunnelEnabledFromSettings: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/sms-funnel.queue", () => ({
  enqueueSmsFunnelJob: vi.fn(),
  removeSmsFunnelJob: (...args: unknown[]) => mockRemoveSmsFunnelJob(...args),
  rescheduleSmsFunnelJob: (...args: unknown[]) =>
    mockRescheduleSmsFunnelJob(...args),
  getSmsFunnelQueue: vi.fn(),
}));

vi.mock("@/modules/sms-funnel/sms-funnel.processor", () => ({
  processSmsFunnelJob: vi.fn(),
}));

import {
  planCallScheduledReschedule,
  rescheduleCallScheduledForFollowUp,
} from "@/modules/sms-funnel/enrollment.service";

describe("getCallScheduledOffsetMs", () => {
  it("maps reminder steps to offsets from call time", () => {
    expect(getCallScheduledOffsetMs("S6-1")).toBeNull();
    expect(getCallScheduledOffsetMs("S6-2")).toBe(-24 * MS_HOUR);
    expect(getCallScheduledOffsetMs("S6-3")).toBe(-2 * MS_HOUR);
    expect(getCallScheduledOffsetMs("S6-4")).toBe(2 * MS_HOUR);
  });
});

describe("planCallScheduledReschedule", () => {
  const followUp = new Date("2026-07-30T12:00:00.000Z");
  const now = new Date("2026-07-28T12:00:00.000Z");

  const pending = [
    {
      id: "msg-1",
      stepKey: "S6-1",
      dedupeKey: "enr:S6-1",
      enrollmentId: "enr",
      sequenceKey: SEQUENCE_KEYS.callScheduled,
    },
    {
      id: "msg-2",
      stepKey: "S6-2",
      dedupeKey: "enr:S6-2",
      enrollmentId: "enr",
      sequenceKey: SEQUENCE_KEYS.callScheduled,
    },
    {
      id: "msg-3",
      stepKey: "S6-3",
      dedupeKey: "enr:S6-3",
      enrollmentId: "enr",
      sequenceKey: SEQUENCE_KEYS.callScheduled,
    },
    {
      id: "msg-4",
      stepKey: "S6-4",
      dedupeKey: "enr:S6-4",
      enrollmentId: "enr",
      sequenceKey: SEQUENCE_KEYS.callScheduled,
    },
  ];

  it("skips confirmation and reschedules reminders relative to follow-up", () => {
    const actions = planCallScheduledReschedule({
      pendingMessages: pending,
      nextFollowUpAt: followUp,
      now,
    });

    expect(actions).toEqual([
      {
        type: "reschedule",
        messageId: "msg-2",
        dedupeKey: "enr:S6-2",
        stepKey: "S6-2",
        sequenceKey: SEQUENCE_KEYS.callScheduled,
        enrollmentId: "enr",
        scheduledFor: new Date("2026-07-29T12:00:00.000Z"),
      },
      {
        type: "reschedule",
        messageId: "msg-3",
        dedupeKey: "enr:S6-3",
        stepKey: "S6-3",
        sequenceKey: SEQUENCE_KEYS.callScheduled,
        enrollmentId: "enr",
        scheduledFor: new Date("2026-07-30T10:00:00.000Z"),
      },
      {
        type: "reschedule",
        messageId: "msg-4",
        dedupeKey: "enr:S6-4",
        stepKey: "S6-4",
        sequenceKey: SEQUENCE_KEYS.callScheduled,
        enrollmentId: "enr",
        scheduledFor: new Date("2026-07-30T14:00:00.000Z"),
      },
    ]);
  });

  it("cancels steps whose send time is already past", () => {
    const soonFollowUp = new Date("2026-07-28T13:00:00.000Z");
    const actions = planCallScheduledReschedule({
      pendingMessages: pending,
      nextFollowUpAt: soonFollowUp,
      now,
    });

    expect(actions.find((a) => a.stepKey === "S6-2")).toMatchObject({
      type: "cancel",
      messageId: "msg-2",
    });
    expect(actions.find((a) => a.stepKey === "S6-3")).toMatchObject({
      type: "cancel",
      messageId: "msg-3",
    });
    expect(actions.find((a) => a.stepKey === "S6-4")).toMatchObject({
      type: "reschedule",
      scheduledFor: new Date("2026-07-28T15:00:00.000Z"),
    });
  });

  it("applies resolveSendTime for quiet-hours adjustment", () => {
    const adjusted = new Date("2026-07-29T14:00:00.000Z");
    const actions = planCallScheduledReschedule({
      pendingMessages: [pending[1]!],
      nextFollowUpAt: followUp,
      now,
      resolveSendTime: () => adjusted,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "reschedule",
      scheduledFor: adjusted,
    });
  });
});

describe("rescheduleCallScheduledForFollowUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFunnelSettings.mockResolvedValue({
      quietHoursStart: 0,
      quietHoursEnd: 24,
    });
    mockCancelPendingSmsMessage.mockResolvedValue({});
    mockUpdateSmsMessageScheduledFor.mockResolvedValue({});
    mockRemoveSmsFunnelJob.mockResolvedValue(undefined);
    mockRescheduleSmsFunnelJob.mockResolvedValue(undefined);
  });

  it("no-ops when there is no active enrollment", async () => {
    mockFindActiveCallScheduledEnrollment.mockResolvedValue(null);

    await rescheduleCallScheduledForFollowUp({
      userId: "user-1",
      assessmentSessionId: "session-1",
      nextFollowUpAt: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(mockListPendingSmsForEnrollment).not.toHaveBeenCalled();
  });

  it("propagates queue reschedule failures after updating scheduledFor", async () => {
    mockFindActiveCallScheduledEnrollment.mockResolvedValue({ id: "enr-1" });
    mockListPendingSmsForEnrollment.mockResolvedValue([
      {
        id: "msg-3",
        stepKey: "S6-3",
        dedupeKey: "enr-1:S6-3",
        enrollmentId: "enr-1",
        sequenceKey: "seq_call_scheduled",
        scheduledFor: new Date("2026-07-29T22:00:00.000Z"),
      },
    ]);
    mockRescheduleSmsFunnelJob.mockRejectedValue(
      new Error("[sms-funnel] queue unavailable; cannot reschedule enr-1:S6-3"),
    );

    await expect(
      rescheduleCallScheduledForFollowUp({
        userId: "user-1",
        assessmentSessionId: "session-1",
        nextFollowUpAt: new Date("2026-07-30T12:00:00.000Z"),
        now: new Date("2026-07-28T12:00:00.000Z"),
      }),
    ).rejects.toThrow(/queue unavailable/);

    expect(mockUpdateSmsMessageScheduledFor).toHaveBeenCalled();
  });

  it("cancels past steps and reschedules future pending reminders", async () => {
    mockFindActiveCallScheduledEnrollment.mockResolvedValue({ id: "enr-1" });
    mockListPendingSmsForEnrollment.mockResolvedValue([
      {
        id: "msg-2",
        stepKey: "S6-2",
        dedupeKey: "enr-1:S6-2",
        enrollmentId: "enr-1",
        sequenceKey: "seq_call_scheduled",
        scheduledFor: new Date("2026-07-29T00:00:00.000Z"),
      },
      {
        id: "msg-3",
        stepKey: "S6-3",
        dedupeKey: "enr-1:S6-3",
        enrollmentId: "enr-1",
        sequenceKey: "seq_call_scheduled",
        scheduledFor: new Date("2026-07-29T22:00:00.000Z"),
      },
    ]);

    const now = new Date("2026-07-28T12:00:00.000Z");
    await rescheduleCallScheduledForFollowUp({
      userId: "user-1",
      assessmentSessionId: "session-1",
      nextFollowUpAt: new Date("2026-07-28T15:00:00.000Z"),
      now,
    });

    expect(mockCancelPendingSmsMessage).toHaveBeenCalledWith(
      "msg-2",
      "follow_up_reschedule_past",
    );
    expect(mockRemoveSmsFunnelJob).toHaveBeenCalledWith("enr-1:S6-2");
    expect(mockUpdateSmsMessageScheduledFor).toHaveBeenCalledWith(
      "msg-3",
      new Date("2026-07-28T13:00:00.000Z"),
    );
    expect(mockRescheduleSmsFunnelJob).toHaveBeenCalledWith(
      expect.objectContaining({
        smsMessageId: "msg-3",
        stepKey: "S6-3",
        dedupeKey: "enr-1:S6-3",
      }),
      MS_HOUR,
    );
  });
});
