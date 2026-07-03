import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    smsFunnelEnabled: true,
    smsQuietHoursStart: 9,
    smsQuietHoursEnd: 21,
    smsFunnelMaxUnanswered: 4,
    kavenegarSenderLine: "10004346",
    kavenegarOtpTemplate: "verify",
    kavenegarApiKey: "test-api-key",
  },
}));

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
const mockSettingFindMany = vi.fn();
const mockSettingUpsert = vi.fn();
const mockSettingDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    smsFunnelStepConfig: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    smsFunnelSetting: {
      findMany: (...args: unknown[]) => mockSettingFindMany(...args),
      upsert: (...args: unknown[]) => mockSettingUpsert(...args),
      deleteMany: (...args: unknown[]) => mockSettingDeleteMany(...args),
    },
  },
}));

describe("funnel-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockSettingFindMany.mockResolvedValue([]);
  });

  it("returns env defaults when no DB settings exist", async () => {
    const { getFunnelSettings } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const settings = await getFunnelSettings();
    expect(settings).toEqual({
      funnelEnabled: true,
      quietHoursStart: 9,
      quietHoursEnd: 21,
      maxUnanswered: 4,
      kavenegarSenderLine: "10004346",
      kavenegarOtpTemplate: "verify",
      apiKeyConfigured: true,
    });
  });

  it("merges DB overrides onto default sequence steps", async () => {
    mockFindMany.mockResolvedValue([
      {
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        body: "custom body",
        bodyLow: null,
        bodyMedium: null,
        bodyHigh: null,
        delayMs: 120_000,
        enabled: true,
      },
    ]);

    const { getResolvedSequence } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const sequence = await getResolvedSequence("seq_start");
    const first = sequence.steps.find((step) => step.stepKey === "S1-1");
    expect(first?.body).toBe("custom body");
    expect(first?.delayMs).toBe(120_000);
    expect(first?.hasOverride).toBe(true);
  });

  it("excludes disabled steps from resolved sequence", async () => {
    mockFindMany.mockResolvedValue([
      {
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        body: null,
        bodyLow: null,
        bodyMedium: null,
        bodyHigh: null,
        delayMs: null,
        enabled: false,
      },
    ]);

    const { getResolvedSequence } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const sequence = await getResolvedSequence("seq_start");
    expect(sequence.steps.some((step) => step.stepKey === "S1-1")).toBe(false);
  });

  it("validates delayMs on update", async () => {
    const { updateStepConfig } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    await expect(
      updateStepConfig("seq_start", "S1-1", { delayMs: -1 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("reads funnel settings from DB when present", async () => {
    mockSettingFindMany.mockResolvedValue([
      { key: "quiet_hours_start", value: "8" },
      { key: "quiet_hours_end", value: "22" },
      { key: "max_unanswered", value: "5" },
      { key: "funnel_enabled", value: "false" },
    ]);

    const { getFunnelSettings } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const settings = await getFunnelSettings();
    expect(settings).toEqual({
      funnelEnabled: false,
      quietHoursStart: 8,
      quietHoursEnd: 22,
      maxUnanswered: 5,
      kavenegarSenderLine: "10004346",
      kavenegarOtpTemplate: "verify",
      apiKeyConfigured: true,
    });
  });

  it("merges DB overrides for Kavenegar sender and template", async () => {
    mockSettingFindMany.mockResolvedValue([
      { key: "kavenegar_sender_line", value: "20001234" },
      { key: "kavenegar_otp_template", value: "custom-otp" },
    ]);

    const { getKavenegarConfig } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const config = await getKavenegarConfig();
    expect(config).toEqual({
      senderLine: "20001234",
      otpTemplate: "custom-otp",
      apiKeyConfigured: true,
    });
  });

  it("falls back to env when Kavenegar DB settings are absent", async () => {
    mockSettingFindMany.mockResolvedValue([]);

    const { getKavenegarConfig } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const config = await getKavenegarConfig();
    expect(config).toEqual({
      senderLine: "10004346",
      otpTemplate: "verify",
      apiKeyConfigured: true,
    });
  });

  it("persists Kavenegar settings via updateFunnelSettings", async () => {
    mockSettingUpsert.mockResolvedValue({});
    mockSettingFindMany.mockResolvedValue([
      { key: "kavenegar_sender_line", value: "30005678" },
      { key: "kavenegar_otp_template", value: "my-template" },
    ]);

    const { updateFunnelSettings } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    const settings = await updateFunnelSettings({
      kavenegarSenderLine: "30005678",
      kavenegarOtpTemplate: "my-template",
    });

    expect(mockSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "kavenegar_sender_line" },
        create: { key: "kavenegar_sender_line", value: "30005678" },
      }),
    );
    expect(settings.kavenegarSenderLine).toBe("30005678");
    expect(settings.kavenegarOtpTemplate).toBe("my-template");
  });

  it("rejects invalid Kavenegar sender line", async () => {
    const { updateFunnelSettings } = await import(
      "@/modules/sms-funnel/funnel-config.service"
    );
    await expect(
      updateFunnelSettings({ kavenegarSenderLine: "bad line!" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
