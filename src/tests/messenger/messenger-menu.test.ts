import { describe, expect, it } from "vitest";
import {
  appendCancelRow,
  buildCancelToMenuRow,
  buildMainMenuRows,
  buildReportActionsRows,
  isPdfCallback,
  MENU_CALLBACKS,
  parsePdfCallback,
  PDF_CALLBACK_PREFIX,
} from "@/modules/messenger/messenger-menu";

describe("messenger menu reset", () => {
  it("includes fresh start when an in-progress assessment exists", () => {
    const rows = buildMainMenuRows({ hasInProgressAssessment: true });
    const callbacks = rows.flat().map((button) => button.callbackData);

    expect(callbacks).toContain(MENU_CALLBACKS.continueAssessment);
    expect(callbacks).toContain(MENU_CALLBACKS.freshStart);
  });

  it("adds cancel row to inline keyboards", () => {
    const rows = appendCancelRow([[{ text: "A", callbackData: "opt-a" }]]);

    expect(rows.at(-1)?.[0]?.callbackData).toBe(MENU_CALLBACKS.cancel);
    expect(buildCancelToMenuRow()[0]?.[0]?.text).toContain("لغو");
  });

  it("parses pdf callbacks and keeps them under 64 bytes", () => {
    const assessmentId = "clx1234567890abcdef";
    const callback = `${PDF_CALLBACK_PREFIX}${assessmentId}`;

    expect(isPdfCallback(callback)).toBe(true);
    expect(parsePdfCallback(callback)).toBe(assessmentId);
    expect(parsePdfCallback("menu:back")).toBeNull();
    expect(callback.length).toBeLessThanOrEqual(64);
  });

  it("includes pdf button only when enabled", () => {
    const assessmentId = "assessment-1";

    const enabled = buildReportActionsRows(assessmentId, { pdfEnabled: true });
    expect(enabled[0]?.[0]?.text).toContain("PDF");
    expect(enabled[0]?.[0]?.callbackData).toBe(`${PDF_CALLBACK_PREFIX}${assessmentId}`);

    const disabled = buildReportActionsRows(assessmentId, { pdfEnabled: false });
    expect(disabled.some((row) => row.some((btn) => btn.text.includes("PDF")))).toBe(
      false,
    );
    expect(disabled.at(-1)?.[0]?.callbackData).toBe(MENU_CALLBACKS.back);
  });
});
