import { describe, expect, it } from "vitest";
import {
  appendCancelRow,
  buildCancelToMenuRow,
  buildMainMenuRows,
  MENU_CALLBACKS,
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
});
