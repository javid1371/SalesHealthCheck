import type { ScoreBand } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import {
  FUNNEL_SEQUENCES,
  getSequenceDefinition,
  type SequenceDefinition,
  type SequenceKey,
  type SequenceStepDefinition,
} from "./sequences";

export const FUNNEL_SETTING_KEYS = {
  quietHoursStart: "quiet_hours_start",
  quietHoursEnd: "quiet_hours_end",
  maxUnanswered: "max_unanswered",
  funnelEnabled: "funnel_enabled",
} as const;

export type FunnelSettingKey =
  (typeof FUNNEL_SETTING_KEYS)[keyof typeof FUNNEL_SETTING_KEYS];

export interface FunnelSettings {
  funnelEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  maxUnanswered: number;
}

export interface ResolvedStepForAdmin extends SequenceStepDefinition {
  enabled: boolean;
  hasOverride: boolean;
  defaultBody: string;
  defaultBodyLow?: string;
  defaultBodyMedium?: string;
  defaultBodyHigh?: string;
  defaultDelayMs: number;
}

export interface ResolvedSequenceForAdmin {
  key: SequenceKey;
  label: string;
  steps: ResolvedStepForAdmin[];
}

export interface UpdateStepConfigInput {
  body?: string | null;
  bodyLow?: string | null;
  bodyMedium?: string | null;
  bodyHigh?: string | null;
  delayMs?: number | null;
  enabled?: boolean;
}

export interface UpdateFunnelSettingsInput {
  funnelEnabled?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  maxUnanswered?: number;
}

const SEQUENCE_LABELS: Record<SequenceKey, string> = {
  seq_start: "شروع Health Check",
  seq_incomplete: "نیمه‌کاره‌ها",
  seq_report_ready: "گزارش آماده",
  seq_nurture: "گزارش دیده — بدون تماس",
  seq_form_abandon: "فرم تماس ناتمام",
  seq_call_scheduled: "تماس ثبت‌شده",
};

const MAX_BODY_LENGTH = 500;

function assertValidHour(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be an integer between 0 and 23`,
      400,
    );
  }
}

function assertValidBody(value: string | null | undefined, field: string): void {
  if (value === null || value === undefined) return;
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError("VALIDATION_ERROR", `${field} cannot be empty`, 400);
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} exceeds ${MAX_BODY_LENGTH} characters`,
      400,
    );
  }
}

function mergeStepWithOverride(
  defaultStep: SequenceStepDefinition,
  override: {
    body: string | null;
    bodyLow: string | null;
    bodyMedium: string | null;
    bodyHigh: string | null;
    delayMs: number | null;
    enabled: boolean;
  } | null,
): ResolvedStepForAdmin {
  const bodyByScoreBand: Partial<Record<ScoreBand, string>> = {
    ...(defaultStep.bodyByScoreBand ?? {}),
  };

  if (override?.bodyLow != null) bodyByScoreBand.low = override.bodyLow;
  if (override?.bodyMedium != null) bodyByScoreBand.medium = override.bodyMedium;
  if (override?.bodyHigh != null) bodyByScoreBand.high = override.bodyHigh;

  const hasOverride = Boolean(
    override &&
      (override.body != null ||
        override.bodyLow != null ||
        override.bodyMedium != null ||
        override.bodyHigh != null ||
        override.delayMs != null ||
        override.enabled === false),
  );

  return {
    ...defaultStep,
    body: override?.body ?? defaultStep.body,
    delayMs: override?.delayMs ?? defaultStep.delayMs,
    enabled: override?.enabled ?? true,
    bodyByScoreBand:
      Object.keys(bodyByScoreBand).length > 0 ? bodyByScoreBand : undefined,
    hasOverride,
    defaultBody: defaultStep.body,
    defaultBodyLow: defaultStep.bodyByScoreBand?.low,
    defaultBodyMedium: defaultStep.bodyByScoreBand?.medium,
    defaultBodyHigh: defaultStep.bodyByScoreBand?.high,
    defaultDelayMs: defaultStep.delayMs,
  };
}

async function loadStepOverridesMap() {
  const rows = await db.smsFunnelStepConfig.findMany();
  return new Map(
    rows.map((row) => [`${row.sequenceKey}:${row.stepKey}`, row] as const),
  );
}

export async function getFunnelSettings(): Promise<FunnelSettings> {
  const rows = await db.smsFunnelSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const funnelEnabledDb = map.get(FUNNEL_SETTING_KEYS.funnelEnabled);
  const quietStartDb = map.get(FUNNEL_SETTING_KEYS.quietHoursStart);
  const quietEndDb = map.get(FUNNEL_SETTING_KEYS.quietHoursEnd);
  const maxUnansweredDb = map.get(FUNNEL_SETTING_KEYS.maxUnanswered);

  return {
    funnelEnabled:
      funnelEnabledDb !== undefined
        ? funnelEnabledDb === "true"
        : env.smsFunnelEnabled,
    quietHoursStart:
      quietStartDb !== undefined
        ? Number.parseInt(quietStartDb, 10)
        : env.smsQuietHoursStart,
    quietHoursEnd:
      quietEndDb !== undefined
        ? Number.parseInt(quietEndDb, 10)
        : env.smsQuietHoursEnd,
    maxUnanswered:
      maxUnansweredDb !== undefined
        ? Number.parseInt(maxUnansweredDb, 10)
        : env.smsFunnelMaxUnanswered,
  };
}

export async function isFunnelEnabledFromSettings(): Promise<boolean> {
  const settings = await getFunnelSettings();
  return settings.funnelEnabled;
}

export async function getResolvedSequence(
  sequenceKey: SequenceKey,
): Promise<SequenceDefinition & { steps: ResolvedStepForAdmin[] }> {
  const defaults = getSequenceDefinition(sequenceKey);
  const overrides = await loadStepOverridesMap();

  const steps = defaults.steps
    .map((step) => {
      const override = overrides.get(`${sequenceKey}:${step.stepKey}`) ?? null;
      return mergeStepWithOverride(step, override);
    })
    .filter((step) => step.enabled);

  return {
    key: defaults.key,
    steps,
  };
}

export async function getResolvedStep(
  sequenceKey: SequenceKey,
  stepKey: string,
): Promise<ResolvedStepForAdmin | null> {
  const defaults = getSequenceDefinition(sequenceKey);
  const defaultStep = defaults.steps.find((s) => s.stepKey === stepKey);
  if (!defaultStep) return null;

  const override = await db.smsFunnelStepConfig.findUnique({
    where: {
      sequenceKey_stepKey: { sequenceKey, stepKey },
    },
  });

  return mergeStepWithOverride(defaultStep, override);
}

export async function getAllResolvedSequences(): Promise<
  ResolvedSequenceForAdmin[]
> {
  const overrides = await loadStepOverridesMap();

  return (Object.keys(FUNNEL_SEQUENCES) as SequenceKey[]).map((key) => {
    const defaults = getSequenceDefinition(key);
    const steps = defaults.steps.map((step) => {
      const override = overrides.get(`${key}:${step.stepKey}`) ?? null;
      return mergeStepWithOverride(step, override);
    });

    return {
      key,
      label: SEQUENCE_LABELS[key],
      steps,
    };
  });
}

export async function updateStepConfig(
  sequenceKey: SequenceKey,
  stepKey: string,
  input: UpdateStepConfigInput,
): Promise<ResolvedStepForAdmin> {
  const defaults = getSequenceDefinition(sequenceKey);
  const defaultStep = defaults.steps.find((s) => s.stepKey === stepKey);
  if (!defaultStep) {
    throw new AppError("NOT_FOUND", "Step not found", 404);
  }

  if (input.body !== undefined) assertValidBody(input.body, "body");
  if (input.bodyLow !== undefined) assertValidBody(input.bodyLow, "bodyLow");
  if (input.bodyMedium !== undefined)
    assertValidBody(input.bodyMedium, "bodyMedium");
  if (input.bodyHigh !== undefined) assertValidBody(input.bodyHigh, "bodyHigh");

  if (input.delayMs !== undefined && input.delayMs !== null) {
    if (!Number.isInteger(input.delayMs) || input.delayMs < 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "delayMs must be a non-negative integer",
        400,
      );
    }
  }

  const data: {
    body?: string | null;
    bodyLow?: string | null;
    bodyMedium?: string | null;
    bodyHigh?: string | null;
    delayMs?: number | null;
    enabled?: boolean;
  } = {};

  if (input.body !== undefined) data.body = input.body?.trim() ?? null;
  if (input.bodyLow !== undefined) data.bodyLow = input.bodyLow?.trim() ?? null;
  if (input.bodyMedium !== undefined)
    data.bodyMedium = input.bodyMedium?.trim() ?? null;
  if (input.bodyHigh !== undefined) data.bodyHigh = input.bodyHigh?.trim() ?? null;
  if (input.delayMs !== undefined) data.delayMs = input.delayMs;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  const row = await db.smsFunnelStepConfig.upsert({
    where: { sequenceKey_stepKey: { sequenceKey, stepKey } },
    create: {
      sequenceKey,
      stepKey,
      ...data,
    },
    update: data,
  });

  return mergeStepWithOverride(defaultStep, row);
}

export async function resetStepConfig(
  sequenceKey: SequenceKey,
  stepKey: string,
): Promise<ResolvedStepForAdmin> {
  const defaults = getSequenceDefinition(sequenceKey);
  const defaultStep = defaults.steps.find((s) => s.stepKey === stepKey);
  if (!defaultStep) {
    throw new AppError("NOT_FOUND", "Step not found", 404);
  }

  await db.smsFunnelStepConfig.deleteMany({
    where: { sequenceKey, stepKey },
  });

  return mergeStepWithOverride(defaultStep, null);
}

export async function updateFunnelSettings(
  input: UpdateFunnelSettingsInput,
): Promise<FunnelSettings> {
  if (input.quietHoursStart !== undefined) {
    assertValidHour(input.quietHoursStart, "quietHoursStart");
    await upsertSetting(
      FUNNEL_SETTING_KEYS.quietHoursStart,
      String(input.quietHoursStart),
    );
  }
  if (input.quietHoursEnd !== undefined) {
    assertValidHour(input.quietHoursEnd, "quietHoursEnd");
    await upsertSetting(
      FUNNEL_SETTING_KEYS.quietHoursEnd,
      String(input.quietHoursEnd),
    );
  }
  if (input.maxUnanswered !== undefined) {
    if (!Number.isInteger(input.maxUnanswered) || input.maxUnanswered < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "maxUnanswered must be a positive integer",
        400,
      );
    }
    await upsertSetting(
      FUNNEL_SETTING_KEYS.maxUnanswered,
      String(input.maxUnanswered),
    );
  }
  if (input.funnelEnabled !== undefined) {
    await upsertSetting(
      FUNNEL_SETTING_KEYS.funnelEnabled,
      input.funnelEnabled ? "true" : "false",
    );
  }

  return getFunnelSettings();
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await db.smsFunnelSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export function formatDelayMs(delayMs: number): string {
  if (delayMs === 0) return "فوری";
  const minutes = Math.round(delayMs / (60 * 1000));
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ساعت`;
  const days = Math.round(hours / 24);
  return `${days} روز`;
}

export function parseDelayInput(value: number, unit: "minute" | "hour" | "day"): number {
  const multipliers = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
  };
  return Math.max(0, Math.round(value * multipliers[unit]));
}
