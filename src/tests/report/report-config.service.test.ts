import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    capacityMode: "free",
  },
}));

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    reportSetting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

describe("report-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
  });

  it("falls back to env capacityMode when DB key is missing", async () => {
    const { getCapacityMode, getReportSettings } = await import(
      "@/modules/report/report-config.service"
    );

    await expect(getCapacityMode()).resolves.toBe("free");
    await expect(getReportSettings()).resolves.toEqual({
      capacityMode: "free",
      envCapacityMode: "free",
      capacityModeOverridden: false,
    });
  });

  it("prefers DB override over env", async () => {
    mockFindUnique.mockResolvedValue({
      key: "capacity_mode",
      value: "full",
    });

    const { getCapacityMode, getReportSettings } = await import(
      "@/modules/report/report-config.service"
    );

    await expect(getCapacityMode()).resolves.toBe("full");
    await expect(getReportSettings()).resolves.toMatchObject({
      capacityMode: "full",
      capacityModeOverridden: true,
    });
  });

  it("rejects invalid capacityMode on update", async () => {
    const { updateReportSettings } = await import(
      "@/modules/report/report-config.service"
    );

    await expect(
      updateReportSettings({
        capacityMode: "busy" as "free",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts capacity_mode and returns settings", async () => {
    mockUpsert.mockResolvedValue({
      key: "capacity_mode",
      value: "full",
    });
    mockFindUnique.mockResolvedValue({
      key: "capacity_mode",
      value: "full",
    });

    const { updateReportSettings } = await import(
      "@/modules/report/report-config.service"
    );

    const settings = await updateReportSettings({ capacityMode: "full" });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: "capacity_mode" },
      create: { key: "capacity_mode", value: "full" },
      update: { value: "full" },
    });
    expect(settings.capacityMode).toBe("full");
    expect(settings.capacityModeOverridden).toBe(true);
  });
});
