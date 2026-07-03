import { describe, expect, it } from "vitest";
import { isWithinSmsQuietHours, nextAllowedSmsSendTime } from "@/modules/sms-funnel/quiet-hours";

describe("sms quiet hours", () => {
  it("allows sends during default daytime window in Tehran", () => {
    const noonTehranUtc = new Date("2026-07-03T08:30:00.000Z");
    expect(isWithinSmsQuietHours(noonTehranUtc)).toBe(true);
  });

  it("defers late-night sends to next allowed window", () => {
    const midnightTehranUtc = new Date("2026-07-03T20:30:00.000Z");
    expect(isWithinSmsQuietHours(midnightTehranUtc)).toBe(false);
    const next = nextAllowedSmsSendTime(midnightTehranUtc);
    expect(next.getTime()).toBeGreaterThan(midnightTehranUtc.getTime());
  });

  it("respects custom quiet hour options", () => {
    const noonTehranUtc = new Date("2026-07-03T08:30:00.000Z");
    expect(
      isWithinSmsQuietHours(noonTehranUtc, { start: 13, end: 18 }),
    ).toBe(false);
    expect(
      isWithinSmsQuietHours(noonTehranUtc, { start: 10, end: 18 }),
    ).toBe(true);
  });
});
