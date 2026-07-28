import { describe, expect, it } from "vitest";
import { validateLogCallRequest } from "@/modules/consultation/consultation-lead.validators";
import {
  resolveQuickCallLogFields,
  suggestAfterCallDefaults,
} from "@/modules/consultation/lead-activity";

describe("validateLogCallRequest", () => {
  it("accepts a valid call outcome with optional note", () => {
    expect(
      validateLogCallRequest({
        outcome: "connected_interested",
        note: "مشتری جلسه می‌خواهد",
      }),
    ).toEqual({
      outcome: "connected_interested",
      note: "مشتری جلسه می‌خواهد",
    });
  });

  it("accepts outcome without note", () => {
    expect(validateLogCallRequest({ outcome: "no_answer" })).toEqual({
      outcome: "no_answer",
    });
  });

  it("accepts optional status, follow-up, and lost fields", () => {
    const nextFollowUpAt = "2026-07-29T00:00:00.000Z";
    expect(
      validateLogCallRequest({
        outcome: "wrong_number",
        status: "closed_lost",
        nextFollowUpAt: null,
        lostReason: "low_quality",
      }),
    ).toEqual({
      outcome: "wrong_number",
      status: "closed_lost",
      nextFollowUpAt: null,
      lostReason: "low_quality",
    });

    expect(
      validateLogCallRequest({
        outcome: "callback_requested",
        status: "contacted",
        nextFollowUpAt,
      }),
    ).toEqual({
      outcome: "callback_requested",
      status: "contacted",
      nextFollowUpAt: new Date(nextFollowUpAt),
    });
  });

  it("requires lostReason when status is closed_lost", () => {
    expect(() =>
      validateLogCallRequest({
        outcome: "connected_not_interested",
        status: "closed_lost",
      }),
    ).toThrowError(/دلیل باخت/);
  });

  it("rejects invalid outcome", () => {
    expect(() =>
      validateLogCallRequest({ outcome: "picked_up" }),
    ).toThrowError(/نتیجه تماس/);
  });

  it("rejects missing outcome", () => {
    expect(() => validateLogCallRequest({ note: "فقط یادداشت" })).toThrowError(
      /نتیجه تماس/,
    );
  });

  it("trims blank note to undefined", () => {
    expect(
      validateLogCallRequest({ outcome: "busy", note: "   " }),
    ).toEqual({ outcome: "busy" });
  });
});

describe("suggestAfterCallDefaults", () => {
  it("maps outcomes to suggested status and follow-up", () => {
    expect(suggestAfterCallDefaults("no_answer")).toEqual({
      nextFollowUpDays: 1,
    });
    expect(suggestAfterCallDefaults("busy")).toEqual({
      nextFollowUpDays: 1,
    });
    expect(suggestAfterCallDefaults("callback_requested")).toEqual({
      status: "contacted",
      nextFollowUpDays: 1,
    });
    expect(suggestAfterCallDefaults("connected_interested")).toEqual({
      status: "contacted",
      nextFollowUpDays: null,
    });
    expect(suggestAfterCallDefaults("connected_not_interested")).toEqual({
      status: "closed_lost",
    });
    expect(suggestAfterCallDefaults("wrong_number")).toEqual({
      status: "closed_lost",
      lostReason: "low_quality",
    });
  });
});

describe("resolveQuickCallLogFields (kanban logQuickCall)", () => {
  it("applies follow-up / status defaults for common quick outcomes", () => {
    expect(resolveQuickCallLogFields("no_answer")).toEqual({
      needsLostReason: false,
      nextFollowUpDays: 1,
    });
    expect(resolveQuickCallLogFields("callback_requested")).toEqual({
      needsLostReason: false,
      status: "contacted",
      nextFollowUpDays: 1,
    });
    expect(resolveQuickCallLogFields("connected_interested")).toEqual({
      needsLostReason: false,
      status: "contacted",
      nextFollowUpDays: null,
    });
  });

  it("closes wrong_number with suggested lost reason", () => {
    expect(resolveQuickCallLogFields("wrong_number")).toEqual({
      needsLostReason: false,
      status: "closed_lost",
      lostReason: "low_quality",
    });
  });

  it("requires a lost reason for connected_not_interested until provided", () => {
    expect(resolveQuickCallLogFields("connected_not_interested")).toEqual({
      needsLostReason: true,
    });
    expect(
      resolveQuickCallLogFields("connected_not_interested", {
        lostReason: "not_a_fit",
      }),
    ).toEqual({
      needsLostReason: false,
      status: "closed_lost",
      lostReason: "not_a_fit",
    });
  });
});
