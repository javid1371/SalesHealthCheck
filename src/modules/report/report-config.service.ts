import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import type { CapacityMode } from "@/types/report-spec";

export const REPORT_SETTING_KEYS = {
  capacityMode: "capacity_mode",
} as const;

export interface ReportSettings {
  /** Report CTA routing — labeled «حالت CTA گزارش» in admin UI. */
  capacityMode: CapacityMode;
  /** Env fallback when DB key is unset. */
  envCapacityMode: CapacityMode;
  /** True when an admin override is stored in report_settings. */
  capacityModeOverridden: boolean;
}

export interface UpdateReportSettingsInput {
  capacityMode?: CapacityMode;
}

function parseCapacityModeValue(value: string | undefined): CapacityMode | null {
  if (value === "free" || value === "full") {
    return value;
  }
  return null;
}

export async function getReportSettings(): Promise<ReportSettings> {
  const row = await db.reportSetting.findUnique({
    where: { key: REPORT_SETTING_KEYS.capacityMode },
  });

  const fromDb = parseCapacityModeValue(row?.value);
  const envCapacityMode = env.capacityMode;

  return {
    capacityMode: fromDb ?? envCapacityMode,
    envCapacityMode,
    capacityModeOverridden: fromDb !== null,
  };
}

export async function getCapacityMode(): Promise<CapacityMode> {
  const settings = await getReportSettings();
  return settings.capacityMode;
}

export async function updateReportSettings(
  input: UpdateReportSettingsInput,
): Promise<ReportSettings> {
  if (input.capacityMode !== undefined) {
    if (input.capacityMode !== "free" && input.capacityMode !== "full") {
      throw new AppError(
        "VALIDATION_ERROR",
        "capacityMode must be 'free' or 'full'",
        400,
      );
    }
    await db.reportSetting.upsert({
      where: { key: REPORT_SETTING_KEYS.capacityMode },
      create: {
        key: REPORT_SETTING_KEYS.capacityMode,
        value: input.capacityMode,
      },
      update: { value: input.capacityMode },
    });
  }

  return getReportSettings();
}
