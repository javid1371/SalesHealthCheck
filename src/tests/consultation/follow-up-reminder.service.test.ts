import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  countFollowUpsDueByAssignee: vi.fn(),
  countOverdueFollowUpsByAssignee: vi.fn(),
  tryCreateStaffReminderLog: vi.fn(),
  deleteStaffReminderLog: vi.fn(),
}));

const staffMock = vi.hoisted(() => ({
  listActiveSalesExpertsWithPhone: vi.fn(),
}));

const smsMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

const quietHoursMock = vi.hoisted(() => ({
  isWithinSmsQuietHours: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    appBaseUrl: "https://app.example.com",
  },
}));
vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/staff/staff.repository", () => staffMock);
vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSenderFromSettings: async () => ({ sendMessage: smsMock.sendMessage }),
}));
vi.mock("@/modules/sms-funnel/quiet-hours", () => ({
  isWithinSmsQuietHours: (...args: unknown[]) =>
    quietHoursMock.isWithinSmsQuietHours(...args),
}));

describe("follow-up-reminder.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quietHoursMock.isWithinSmsQuietHours.mockReturnValue(true);
    staffMock.listActiveSalesExpertsWithPhone.mockResolvedValue([
      { id: "expert-1", phone: "09120000001", name: "Ali" },
      { id: "expert-2", phone: "09120000002", name: "Sara" },
    ]);
    repoMock.countFollowUpsDueByAssignee.mockResolvedValue([]);
    repoMock.countOverdueFollowUpsByAssignee.mockResolvedValue([]);
    repoMock.tryCreateStaffReminderLog.mockResolvedValue(true);
    repoMock.deleteStaffReminderLog.mockResolvedValue(undefined);
    smsMock.sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips entirely outside the morning digest window", async () => {
    quietHoursMock.isWithinSmsQuietHours.mockReturnValue(false);
    const { processFollowUpReminderDigests } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    const result = await processFollowUpReminderDigests();

    expect(result).toEqual({
      sent: 0,
      skippedQuietHours: true,
      skippedAlreadySent: 0,
      skippedNoDue: 0,
      failed: 0,
    });
    expect(staffMock.listActiveSalesExpertsWithPhone).not.toHaveBeenCalled();
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("does not SMS experts with no due follow-ups", async () => {
    const { processFollowUpReminderDigests } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    const result = await processFollowUpReminderDigests();

    expect(result.sent).toBe(0);
    expect(result.skippedNoDue).toBe(2);
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
    expect(repoMock.tryCreateStaffReminderLog).not.toHaveBeenCalled();
  });

  it("sends one digest SMS when an expert has due follow-ups", async () => {
    repoMock.countFollowUpsDueByAssignee.mockResolvedValue([
      { assignedToId: "expert-1", count: 3 },
    ]);
    repoMock.countOverdueFollowUpsByAssignee.mockResolvedValue([
      { assignedToId: "expert-1", count: 1 },
    ]);

    const {
      processFollowUpReminderDigests,
      renderFollowUpDigestSms,
      buildExpertFollowUpListUrl,
    } = await import("@/modules/consultation/follow-up-reminder.service");

    const result = await processFollowUpReminderDigests();

    expect(result.sent).toBe(1);
    expect(result.skippedNoDue).toBe(1);
    expect(repoMock.tryCreateStaffReminderLog).toHaveBeenCalledTimes(1);
    expect(smsMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(smsMock.sendMessage).toHaveBeenCalledWith(
      "09120000001",
      renderFollowUpDigestSms({
        dueCount: 3,
        overdueCount: 1,
        listUrl: buildExpertFollowUpListUrl(),
      }),
    );
  });

  it("skips experts who already received today's digest", async () => {
    repoMock.countFollowUpsDueByAssignee.mockResolvedValue([
      { assignedToId: "expert-1", count: 2 },
    ]);
    repoMock.tryCreateStaffReminderLog.mockResolvedValue(false);

    const { processFollowUpReminderDigests } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    const result = await processFollowUpReminderDigests();

    expect(result.sent).toBe(0);
    expect(result.skippedAlreadySent).toBe(1);
    expect(smsMock.sendMessage).not.toHaveBeenCalled();
  });

  it("releases the reminder claim when SMS send fails so a later tick can retry", async () => {
    repoMock.countFollowUpsDueByAssignee.mockResolvedValue([
      { assignedToId: "expert-1", count: 1 },
    ]);
    smsMock.sendMessage.mockRejectedValue(new Error("sms down"));

    const { processFollowUpReminderDigests, tehranCalendarDate } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    const now = new Date("2026-07-28T06:30:00.000Z");
    const result = await processFollowUpReminderDigests(now);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(repoMock.deleteStaffReminderLog).toHaveBeenCalledWith({
      staffUserId: "expert-1",
      date: tehranCalendarDate(now),
      type: "follow_up_digest",
    });
  });

  it("builds the follow-up list URL with onlyFollowUpDueToday=true", async () => {
    const { buildExpertFollowUpListUrl, renderFollowUpDigestSms } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    expect(buildExpertFollowUpListUrl()).toBe(
      "https://app.example.com/expert/consultations?onlyFollowUpDueToday=true",
    );
    expect(
      renderFollowUpDigestSms({
        dueCount: 4,
        overdueCount: 2,
        listUrl: buildExpertFollowUpListUrl(),
      }),
    ).toBe(
      "امروز 4 پیگیری دارید (از جمله 2 عقب‌افتاده). لیست: https://app.example.com/expert/consultations?onlyFollowUpDueToday=true",
    );
  });

  it("uses Asia/Tehran calendar day for the reminder date key", async () => {
    const { tehranCalendarDate } = await import(
      "@/modules/consultation/follow-up-reminder.service"
    );

    // 2026-07-27 22:30 UTC = 2026-07-28 02:00 Tehran
    expect(tehranCalendarDate(new Date("2026-07-27T22:30:00.000Z"))).toEqual(
      new Date(Date.UTC(2026, 6, 28)),
    );
  });
});
