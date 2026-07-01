import { describe, expect, it } from "vitest";
import {
  MESSENGER_BUTTON_MAX_LENGTH,
  resolveMessengerButtonLabel,
  truncateMessengerLabel,
} from "@/modules/messenger/messenger-labels.utils";

describe("messenger labels utils", () => {
  it("truncates long fallback labels to 64 chars", () => {
    const longText = "الف".repeat(80);
    const result = truncateMessengerLabel(longText);

    expect(result.length).toBe(MESSENGER_BUTTON_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  it("prefers messenger label over option text", () => {
    const label = resolveMessengerButtonLabel("۰ بحرانی: بدون معیار", "متن بلند گزینه");

    expect(label).toBe("۰ بحرانی: بدون معیار");
  });

  it("falls back to truncated option text when label missing", () => {
    const longText = "گزینه".repeat(30);
    const label = resolveMessengerButtonLabel(null, longText);

    expect(label.length).toBeLessThanOrEqual(MESSENGER_BUTTON_MAX_LENGTH);
  });
});
