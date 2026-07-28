import { describe, expect, it } from "vitest";
import {
  formatActivityDetail,
  formatAssignmentChangeDetail,
  formatCallLoggedDetail,
  formatTransferNoteBody,
  serializeAssignmentChangeDetail,
  serializeCallLoggedDetail,
} from "@/modules/consultation/lead-activity";

describe("assignment_change activity formatting", () => {
  it("formats JSON handoff with reason into readable Persian text", () => {
    const detail = serializeAssignmentChangeDetail({
      fromId: "a",
      toId: "b",
      fromName: "علی",
      toName: "سارا",
      reason: "workload",
    });

    expect(formatAssignmentChangeDetail(detail)).toBe("علی → سارا | حجم کار");
    expect(formatActivityDetail("assignment_change", detail)).toBe(
      "علی → سارا | حجم کار",
    );
  });

  it("formats unassigned and auto-assign cases", () => {
    expect(
      formatAssignmentChangeDetail(
        serializeAssignmentChangeDetail({
          fromId: null,
          toId: "b",
          fromName: null,
          toName: "سارا",
        }),
      ),
    ).toBe("بدون تخصیص → سارا");

    expect(formatAssignmentChangeDetail("unassigned")).toBe("لغو تخصیص");
  });

  it("keeps legacy assignee id details as passthrough", () => {
    expect(formatAssignmentChangeDetail("expert-legacy-id")).toBe(
      "expert-legacy-id",
    );
  });

  it("builds transfer note with reason prefix", () => {
    expect(formatTransferNoteBody("leave", "تا پنجشنبه در دسترس نیستم")).toBe(
      "انتقال: مرخصی — تا پنجشنبه در دسترس نیستم",
    );
  });
});

describe("call_logged activity formatting", () => {
  it("formats plain outcome codes", () => {
    expect(formatCallLoggedDetail("no_answer")).toBe("بدون پاسخ");
    expect(formatActivityDetail("call_logged", "busy")).toBe("اشغال");
  });

  it("formats JSON detail with optional note", () => {
    const detail = serializeCallLoggedDetail(
      "connected_interested",
      "جلسه فردا",
    );
    expect(formatCallLoggedDetail(detail)).toBe(
      "وصل — علاقه‌مند — جلسه فردا",
    );
    expect(formatActivityDetail("call_logged", detail)).toBe(
      "وصل — علاقه‌مند — جلسه فردا",
    );
  });

  it("serializes outcome-only detail as plain string", () => {
    expect(serializeCallLoggedDetail("callback_requested")).toBe(
      "callback_requested",
    );
  });
});
