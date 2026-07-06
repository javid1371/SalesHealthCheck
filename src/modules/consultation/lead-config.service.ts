import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { findStaffUserById } from "@/modules/staff/staff.repository";

export const LEAD_SETTING_KEYS = {
  autoAssignEnabled: "auto_assign_enabled",
  systemAssignDelayHours: "system_assign_delay_hours",
  expertNewLeadSms: "expert_new_lead_sms",
  maxOpenLeadsPerExpert: "max_open_leads_per_expert",
  hotLeadDirectAssigneeId: "hot_lead_direct_assignee_id",
} as const;

export const DEFAULT_EXPERT_NEW_LEAD_SMS = "لید جدید داری\nچک کن";

const DEFAULT_MAX_OPEN_LEADS_PER_EXPERT = 30;
const MAX_SMS_BODY_LENGTH = 500;

export interface LeadSettings {
  autoAssignEnabled: boolean;
  systemAssignDelayHours: number;
  expertNewLeadSms: string;
  maxOpenLeadsPerExpert: number;
  hotLeadDirectAssigneeId: string | null;
}

export interface UpdateLeadSettingsInput {
  autoAssignEnabled?: boolean;
  systemAssignDelayHours?: number;
  expertNewLeadSms?: string;
  maxOpenLeadsPerExpert?: number;
  hotLeadDirectAssigneeId?: string | null;
}

function assertValidDelayHours(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "systemAssignDelayHours must be a non-negative integer",
      400,
    );
  }
}

function assertValidMaxOpenLeads(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "maxOpenLeadsPerExpert must be a positive integer",
      400,
    );
  }
}

function assertValidExpertNewLeadSms(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(
      "VALIDATION_ERROR",
      "expertNewLeadSms cannot be empty",
      400,
    );
  }
  if (trimmed.length > MAX_SMS_BODY_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `expertNewLeadSms exceeds ${MAX_SMS_BODY_LENGTH} characters`,
      400,
    );
  }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await db.leadSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function deleteSetting(key: string): Promise<void> {
  await db.leadSetting.deleteMany({ where: { key } });
}

export async function getLeadSettings(): Promise<LeadSettings> {
  const rows = await db.leadSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const autoAssignDb = map.get(LEAD_SETTING_KEYS.autoAssignEnabled);
  const delayHoursDb = map.get(LEAD_SETTING_KEYS.systemAssignDelayHours);
  const expertSmsDb = map.get(LEAD_SETTING_KEYS.expertNewLeadSms);
  const maxOpenDb = map.get(LEAD_SETTING_KEYS.maxOpenLeadsPerExpert);
  const hotAssigneeDb = map.get(LEAD_SETTING_KEYS.hotLeadDirectAssigneeId);

  return {
    autoAssignEnabled:
      autoAssignDb !== undefined
        ? autoAssignDb === "true"
        : env.leadAutoAssignEnabled,
    systemAssignDelayHours:
      delayHoursDb !== undefined
        ? Number.parseInt(delayHoursDb, 10)
        : env.leadSystemAssignDelayHours,
    expertNewLeadSms:
      expertSmsDb !== undefined ? expertSmsDb : DEFAULT_EXPERT_NEW_LEAD_SMS,
    maxOpenLeadsPerExpert:
      maxOpenDb !== undefined
        ? Number.parseInt(maxOpenDb, 10)
        : DEFAULT_MAX_OPEN_LEADS_PER_EXPERT,
    hotLeadDirectAssigneeId:
      hotAssigneeDb !== undefined && hotAssigneeDb.length > 0
        ? hotAssigneeDb
        : null,
  };
}

export async function updateLeadSettings(
  input: UpdateLeadSettingsInput,
): Promise<LeadSettings> {
  if (input.systemAssignDelayHours !== undefined) {
    assertValidDelayHours(input.systemAssignDelayHours);
    await upsertSetting(
      LEAD_SETTING_KEYS.systemAssignDelayHours,
      String(input.systemAssignDelayHours),
    );
  }

  if (input.maxOpenLeadsPerExpert !== undefined) {
    assertValidMaxOpenLeads(input.maxOpenLeadsPerExpert);
    await upsertSetting(
      LEAD_SETTING_KEYS.maxOpenLeadsPerExpert,
      String(input.maxOpenLeadsPerExpert),
    );
  }

  if (input.autoAssignEnabled !== undefined) {
    await upsertSetting(
      LEAD_SETTING_KEYS.autoAssignEnabled,
      input.autoAssignEnabled ? "true" : "false",
    );
  }

  if (input.expertNewLeadSms !== undefined) {
    assertValidExpertNewLeadSms(input.expertNewLeadSms);
    await upsertSetting(
      LEAD_SETTING_KEYS.expertNewLeadSms,
      input.expertNewLeadSms.trim(),
    );
  }

  if (input.hotLeadDirectAssigneeId !== undefined) {
    if (input.hotLeadDirectAssigneeId === null) {
      await deleteSetting(LEAD_SETTING_KEYS.hotLeadDirectAssigneeId);
    } else {
      const assignee = await findStaffUserById(input.hotLeadDirectAssigneeId);
      if (!assignee || !assignee.isActive || assignee.role !== "sales_expert") {
        throw new AppError(
          "VALIDATION_ERROR",
          "hotLeadDirectAssigneeId must be an active sales expert",
          400,
        );
      }
      await upsertSetting(
        LEAD_SETTING_KEYS.hotLeadDirectAssigneeId,
        input.hotLeadDirectAssigneeId,
      );
    }
  }

  return getLeadSettings();
}
