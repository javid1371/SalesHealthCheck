import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    smsFunnelEnabled: true,
    smsQuietHoursStart: 9,
    smsQuietHoursEnd: 21,
    smsFunnelMaxUnanswered: 4,
  },
}));

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
const mockSettingFindMany = vi.fn();
const mockSettingUpsert = vi.fn();

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
    });
  });
});
