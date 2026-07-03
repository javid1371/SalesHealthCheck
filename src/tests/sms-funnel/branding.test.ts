import { describe, expect, it } from "vitest";
import {
  buildBrandedSmsMessage,
  SMS_BRAND_SIGNATURE,
} from "@/modules/sms-funnel/branding";

describe("sms-funnel branding", () => {
  it("appends brand signature to every message", () => {
    const message = buildBrandedSmsMessage("سلام تست");
    expect(message).toContain(SMS_BRAND_SIGNATURE);
    expect(message.endsWith(SMS_BRAND_SIGNATURE)).toBe(true);
  });

  it("includes short link when provided", () => {
    const message = buildBrandedSmsMessage("متن", "https://example.com/l/abc");
    expect(message).toContain("https://example.com/l/abc");
  });
});
