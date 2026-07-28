import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    appBaseUrl: "https://app.example.com/",
  },
}));

import {
  buildExpertLeadDetailUrl,
  expertNewLeadSmsHasPlaceholders,
  EXPERT_NEW_LEAD_SMS_MAX_LENGTH,
  renderExpertNewLeadSms,
} from "@/modules/consultation/expert-new-lead-sms";

describe("expert-new-lead-sms", () => {
  const lead = {
    id: "lead-42",
    name: "علی رضایی",
    phone: "09121234567",
    purchaseProbabilityPercent: 78,
    purchaseProbabilityBand: "high" as const,
    adminProbabilityOverridePercent: null,
  };

  it("detects known placeholders only", () => {
    expect(expertNewLeadSmsHasPlaceholders("لید جدید داری")).toBe(false);
    expect(expertNewLeadSmsHasPlaceholders("لید {{name}}")).toBe(true);
    expect(expertNewLeadSmsHasPlaceholders("{{detailUrl}}")).toBe(true);
    expect(expertNewLeadSmsHasPlaceholders("{{unknown}}")).toBe(false);
  });

  it("builds detail URL from APP_BASE_URL without trailing slash duplication", () => {
    expect(buildExpertLeadDetailUrl("lead-42")).toBe(
      "https://app.example.com/expert/consultations/lead-42",
    );
  });

  it("returns template unchanged when no placeholders are present", () => {
    const template = "لید جدید داری\nچک کن";
    expect(renderExpertNewLeadSms(template, lead)).toBe(template);
  });

  it("interpolates optional placeholders", () => {
    const template =
      "لید {{name}} / {{phone}} / {{probability}}\n{{detailUrl}}";

    expect(renderExpertNewLeadSms(template, lead)).toBe(
      "لید علی رضایی / 09121234567 / بالا — 78٪\nhttps://app.example.com/expert/consultations/lead-42",
    );
  });

  it("uses admin probability override when present", () => {
    const body = renderExpertNewLeadSms("احتمال: {{probability}}", {
      ...lead,
      adminProbabilityOverridePercent: 45,
    });

    expect(body).toBe("احتمال: متوسط — 45٪");
  });

  it("fills missing phone/probability with empty string", () => {
    const body = renderExpertNewLeadSms("{{name}}|{{phone}}|{{probability}}", {
      id: "lead-1",
      name: "بدون شماره",
      phone: null,
      purchaseProbabilityPercent: null,
      purchaseProbabilityBand: null,
    });

    expect(body).toBe("بدون شماره||");
  });

  it("keeps max length constant aligned for send-time checks", () => {
    expect(EXPERT_NEW_LEAD_SMS_MAX_LENGTH).toBe(500);
  });
});
