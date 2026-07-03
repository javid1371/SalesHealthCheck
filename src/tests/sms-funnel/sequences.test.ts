import { describe, expect, it } from "vitest";
import {
  FUNNEL_SEQUENCES,
  resolveStepBody,
  SEQUENCE_KEYS,
} from "@/modules/sms-funnel/sequences";
import { SMS_BRAND_SIGNATURE } from "@/modules/sms-funnel/branding";
import { buildBrandedSmsMessage } from "@/modules/sms-funnel/branding";

describe("sms-funnel sequences", () => {
  it("defines all six funnel sequences", () => {
    expect(Object.keys(FUNNEL_SEQUENCES)).toHaveLength(6);
    expect(FUNNEL_SEQUENCES[SEQUENCE_KEYS.nurture].steps).toHaveLength(4);
  });

  it("uses score band overrides for nurture conversion steps", () => {
    const step = FUNNEL_SEQUENCES[SEQUENCE_KEYS.nurture].steps.find(
      (s) => s.stepKey === "S4-1",
    );
    expect(step).toBeDefined();
    expect(resolveStepBody(step!, "low")).toContain("ریزش جدی");
    expect(resolveStepBody(step!, "high")).toContain("مقیاس");
  });

  it("keeps branded messages reasonably structured", () => {
    const step = FUNNEL_SEQUENCES[SEQUENCE_KEYS.reportReady].steps[0];
    const body = buildBrandedSmsMessage(
      resolveStepBody(step),
      "https://example.com/l/x",
    );
    expect(body).toContain(SMS_BRAND_SIGNATURE);
    expect(body.split("\n").length).toBeGreaterThanOrEqual(3);
  });
});
