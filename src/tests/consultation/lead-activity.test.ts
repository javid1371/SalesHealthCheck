import { describe, expect, it } from "vitest";
import {
  formatActivityDetail,
  formatAssignmentChangeDetail,
  formatCallLoggedDetail,
  formatStatusChangeDetail,
  formatStatusChangeJourneyLabel,
  formatTransferNoteBody,
  resolveActivityTimelineLabel,
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

describe("status_change journey labels", () => {
  it("labels status=new as آماده تماس (column name, not journey event)", () => {
    expect(formatStatusChangeDetail("new", "contacted")).toBe(
      "آماده تماس → تماس گرفته‌شده",
    );
  });

  it("maps known assessment journey transitions", () => {
    expect(
      formatStatusChangeJourneyLabel(
        "assessment_in_progress",
        "assessment_completed",
      ),
    ).toBe("تست تکمیل شد");
    expect(
      formatStatusChangeJourneyLabel("assessment_in_progress", "assessment_incomplete"),
    ).toBe("تست نیمه‌کاره شد");
    expect(
      formatStatusChangeJourneyLabel("assessment_completed", "new"),
    ).toBe("درخواست مشاوره ثبت شد");
    expect(formatStatusChangeJourneyLabel("new", "contacted")).toBeNull();
  });

  it("uses journey label on timeline for status_change activities", () => {
    expect(
      resolveActivityTimelineLabel(
        "status_change",
        "assessment_in_progress→assessment_completed",
      ),
    ).toBe("تست تکمیل شد");
    expect(resolveActivityTimelineLabel("status_change", "new→contacted")).toBe(
      "تغییر وضعیت",
    );
  });

  it("formats assessment_start created detail", () => {
    expect(formatActivityDetail("created", "assessment_start")).toBe(
      "شروع تست / ایجاد لید سیستمی",
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
