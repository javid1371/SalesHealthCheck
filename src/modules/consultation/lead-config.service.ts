import type {
  CallOutcome,
  LeadSource,
  LeadStatus,
  LostReason,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { findStaffUserById } from "@/modules/staff/staff.repository";
import {
  EXPERT_NEW_LEAD_SMS_MAX_LENGTH,
  expertNewLeadSmsHasPlaceholders,
  renderExpertNewLeadSms,
} from "./expert-new-lead-sms";
import {
  CALL_OUTCOMES,
  LOST_REASONS,
  cloneDefaultCallOutcomeMatrix,
  type AfterCallSuggestion,
  type CallOutcomeMatrix,
} from "./lead-activity";

export const LEAD_SETTING_KEYS = {
  autoAssignEnabled: "auto_assign_enabled",
  systemAssignDelayHours: "system_assign_delay_hours",
  expertNewLeadSms: "expert_new_lead_sms",
  maxOpenLeadsPerExpert: "max_open_leads_per_expert",
  hotLeadDirectAssigneeId: "hot_lead_direct_assignee_id",
  assessmentIncompleteAfterHours: "assessment_incomplete_after_hours",
  autoAssignExcludeStaffIds: "auto_assign_exclude_staff_ids",
  staleNewLeadHours: "stale_new_lead_hours",
  routingRulesJson: "routing_rules_json",
  callOutcomeMatrixJson: "call_outcome_matrix_json",
  requireCallOutcomeBeforeClose: "require_call_outcome_before_close",
  createLeadOnAssessmentStart: "create_lead_on_assessment_start",
  pauseSystemLeadCreation: "pause_system_lead_creation",
  adminOverdueFollowUpSmsEnabled: "admin_overdue_follow_up_sms_enabled",
} as const;

const LEAD_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
  "unreachable",
];

export const DEFAULT_EXPERT_NEW_LEAD_SMS = "لید جدید داری\nچک کن";

const DEFAULT_MAX_OPEN_LEADS_PER_EXPERT = 30;
const DEFAULT_STALE_NEW_LEAD_HOURS = 24;

const LEAD_SOURCES: LeadSource[] = ["direct", "system", "messenger"];

export type FirstContactSlaMinutesByBand = {
  high: number;
  mid: number;
  low: number;
};

export type PreferAssigneeBySource = Partial<
  Record<"messenger" | "direct" | "system", string>
>;

export interface LeadRoutingRules {
  firstContactSlaMinutesByBand: FirstContactSlaMinutesByBand;
  preferAssigneeBySource: PreferAssigneeBySource;
  excludeSourcesFromAutoAssign: LeadSource[];
}

export const DEFAULT_ROUTING_RULES: LeadRoutingRules = {
  firstContactSlaMinutesByBand: { high: 30, mid: 120, low: 240 },
  preferAssigneeBySource: {},
  excludeSourcesFromAutoAssign: [],
};

export interface LeadSettings {
  autoAssignEnabled: boolean;
  systemAssignDelayHours: number;
  expertNewLeadSms: string;
  maxOpenLeadsPerExpert: number;
  hotLeadDirectAssigneeId: string | null;
  assessmentIncompleteAfterHours: number;
  /** Staff IDs excluded from automatic round-robin assignment. */
  autoAssignExcludeStaffIds: string[];
  /** Hours after which a `new` lead is considered stale (SLA / admin KPI). */
  staleNewLeadHours: number;
  routingRules: LeadRoutingRules;
  /** Outcome → suggested status / follow-up / lost reason for call logging UI. */
  callOutcomeMatrix: CallOutcomeMatrix;
  /** When true, closed_lost / unreachable require a prior call outcome. */
  requireCallOutcomeBeforeClose: boolean;
  /** When false, assessment start does not create/update system pipeline leads. */
  createLeadOnAssessmentStart: boolean;
  /** When true, block creating new system-sourced leads (existing leads still update). */
  pauseSystemLeadCreation: boolean;
  /**
   * Morning SMS to active admins listing overdue follow-ups by expert
   * (for chasing sales staff).
   */
  adminOverdueFollowUpSmsEnabled: boolean;
}

export interface UpdateLeadSettingsInput {
  autoAssignEnabled?: boolean;
  systemAssignDelayHours?: number;
  expertNewLeadSms?: string;
  maxOpenLeadsPerExpert?: number;
  hotLeadDirectAssigneeId?: string | null;
  assessmentIncompleteAfterHours?: number;
  autoAssignExcludeStaffIds?: string[];
  staleNewLeadHours?: number;
  routingRules?: LeadRoutingRules;
  callOutcomeMatrix?: CallOutcomeMatrix;
  requireCallOutcomeBeforeClose?: boolean;
  createLeadOnAssessmentStart?: boolean;
  pauseSystemLeadCreation?: boolean;
  adminOverdueFollowUpSmsEnabled?: boolean;
}

function parseStaffIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function serializeStaffIdList(ids: string[]): string {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].join(",");
}

function assertPositiveMinutes(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a positive integer`,
      400,
    );
  }
  return value;
}

function normalizeRoutingRules(input: unknown): LeadRoutingRules {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "routingRules must be an object",
      400,
    );
  }

  const data = input as Record<string, unknown>;
  const bandRaw = data.firstContactSlaMinutesByBand;
  if (!bandRaw || typeof bandRaw !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "routingRules.firstContactSlaMinutesByBand is required",
      400,
    );
  }
  const band = bandRaw as Record<string, unknown>;
  const firstContactSlaMinutesByBand: FirstContactSlaMinutesByBand = {
    high: assertPositiveMinutes(
      band.high,
      "routingRules.firstContactSlaMinutesByBand.high",
    ),
    mid: assertPositiveMinutes(
      band.mid,
      "routingRules.firstContactSlaMinutesByBand.mid",
    ),
    low: assertPositiveMinutes(
      band.low,
      "routingRules.firstContactSlaMinutesByBand.low",
    ),
  };

  const preferRaw = data.preferAssigneeBySource;
  const preferAssigneeBySource: PreferAssigneeBySource = {};
  if (preferRaw !== undefined && preferRaw !== null) {
    if (typeof preferRaw !== "object") {
      throw new AppError(
        "VALIDATION_ERROR",
        "routingRules.preferAssigneeBySource must be an object",
        400,
      );
    }
    const prefer = preferRaw as Record<string, unknown>;
    for (const source of ["messenger", "direct", "system"] as const) {
      const value = prefer[source];
      if (value === undefined || value === null || value === "") {
        continue;
      }
      if (typeof value !== "string" || !value.trim()) {
        throw new AppError(
          "VALIDATION_ERROR",
          `routingRules.preferAssigneeBySource.${source} must be a staff id`,
          400,
        );
      }
      preferAssigneeBySource[source] = value.trim();
    }
  }

  const excludeRaw = data.excludeSourcesFromAutoAssign;
  let excludeSourcesFromAutoAssign: LeadSource[] = [];
  if (excludeRaw !== undefined && excludeRaw !== null) {
    if (!Array.isArray(excludeRaw)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "routingRules.excludeSourcesFromAutoAssign must be an array",
        400,
      );
    }
    excludeSourcesFromAutoAssign = [
      ...new Set(
        excludeRaw.map((item) => {
          if (
            typeof item !== "string" ||
            !LEAD_SOURCES.includes(item as LeadSource)
          ) {
            throw new AppError(
              "VALIDATION_ERROR",
              "routingRules.excludeSourcesFromAutoAssign contains an invalid source",
              400,
            );
          }
          return item as LeadSource;
        }),
      ),
    ];
  }

  return {
    firstContactSlaMinutesByBand,
    preferAssigneeBySource,
    excludeSourcesFromAutoAssign,
  };
}

function cloneDefaultRoutingRules(): LeadRoutingRules {
  return {
    firstContactSlaMinutesByBand: {
      ...DEFAULT_ROUTING_RULES.firstContactSlaMinutesByBand,
    },
    preferAssigneeBySource: {},
    excludeSourcesFromAutoAssign: [],
  };
}

function parseRoutingRulesJson(raw: string | undefined): LeadRoutingRules {
  if (!raw?.trim()) {
    return cloneDefaultRoutingRules();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeRoutingRules({
      firstContactSlaMinutesByBand: {
        ...DEFAULT_ROUTING_RULES.firstContactSlaMinutesByBand,
        ...((parsed as { firstContactSlaMinutesByBand?: unknown })
          ?.firstContactSlaMinutesByBand ?? {}),
      },
      preferAssigneeBySource:
        (parsed as { preferAssigneeBySource?: unknown })
          ?.preferAssigneeBySource ?? {},
      excludeSourcesFromAutoAssign:
        (parsed as { excludeSourcesFromAutoAssign?: unknown })
          ?.excludeSourcesFromAutoAssign ?? [],
    });
  } catch {
    return cloneDefaultRoutingRules();
  }
}

function normalizeAfterCallSuggestion(
  outcome: CallOutcome,
  input: unknown,
): AfterCallSuggestion {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      `callOutcomeMatrix.${outcome} must be an object`,
      400,
    );
  }

  const data = input as Record<string, unknown>;
  const suggestion: AfterCallSuggestion = {};

  if (data.status !== undefined && data.status !== null && data.status !== "") {
    if (
      typeof data.status !== "string" ||
      !LEAD_STATUSES.includes(data.status as LeadStatus)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `callOutcomeMatrix.${outcome}.status is invalid`,
        400,
      );
    }
    suggestion.status = data.status as LeadStatus;
  }

  if ("nextFollowUpDays" in data) {
    if (data.nextFollowUpDays === null) {
      suggestion.nextFollowUpDays = null;
    } else if (
      typeof data.nextFollowUpDays === "number" &&
      Number.isInteger(data.nextFollowUpDays) &&
      data.nextFollowUpDays >= 0
    ) {
      suggestion.nextFollowUpDays = data.nextFollowUpDays;
    } else if (data.nextFollowUpDays !== undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        `callOutcomeMatrix.${outcome}.nextFollowUpDays must be a non-negative integer or null`,
        400,
      );
    }
  }

  if (
    data.lostReason !== undefined &&
    data.lostReason !== null &&
    data.lostReason !== ""
  ) {
    if (
      typeof data.lostReason !== "string" ||
      !LOST_REASONS.includes(data.lostReason as LostReason)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `callOutcomeMatrix.${outcome}.lostReason is invalid`,
        400,
      );
    }
    suggestion.lostReason = data.lostReason as LostReason;
  }

  return suggestion;
}

function normalizeCallOutcomeMatrix(input: unknown): CallOutcomeMatrix {
  if (!input || typeof input !== "object") {
    throw new AppError(
      "VALIDATION_ERROR",
      "callOutcomeMatrix must be an object",
      400,
    );
  }

  const data = input as Record<string, unknown>;
  const matrix = cloneDefaultCallOutcomeMatrix();

  for (const outcome of CALL_OUTCOMES) {
    if (data[outcome] === undefined) {
      continue;
    }
    matrix[outcome] = normalizeAfterCallSuggestion(outcome, data[outcome]);
  }

  return matrix;
}

function parseCallOutcomeMatrixJson(raw: string | undefined): CallOutcomeMatrix {
  if (!raw?.trim()) {
    return cloneDefaultCallOutcomeMatrix();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeCallOutcomeMatrix(parsed);
  } catch (error) {
    if (error instanceof AppError) {
      return cloneDefaultCallOutcomeMatrix();
    }
    return cloneDefaultCallOutcomeMatrix();
  }
}

function parseBoolSetting(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined) {
    return defaultValue;
  }
  return raw === "true";
}

function assertValidDelayHours(value: number, field = "systemAssignDelayHours"): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a non-negative integer`,
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

function assertValidStaleNewLeadHours(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "staleNewLeadHours must be a positive integer",
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
  if (trimmed.length > EXPERT_NEW_LEAD_SMS_MAX_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `expertNewLeadSms exceeds ${EXPERT_NEW_LEAD_SMS_MAX_LENGTH} characters`,
      400,
    );
  }

  if (!expertNewLeadSmsHasPlaceholders(trimmed)) {
    return;
  }

  // Reject templates that already overflow with representative sample values.
  const rendered = renderExpertNewLeadSms(trimmed, {
    id: "00000000-0000-0000-0000-000000000000",
    name: "نمونه نام بلند کارشناس برای سنجش طول پیامک",
    phone: "09121234567",
    purchaseProbabilityPercent: 99,
    purchaseProbabilityBand: "high",
    adminProbabilityOverridePercent: null,
  });
  if (rendered.length > EXPERT_NEW_LEAD_SMS_MAX_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `expertNewLeadSms exceeds ${EXPERT_NEW_LEAD_SMS_MAX_LENGTH} characters after placeholders`,
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
  const incompleteHoursDb = map.get(
    LEAD_SETTING_KEYS.assessmentIncompleteAfterHours,
  );
  const excludeStaffIdsDb = map.get(
    LEAD_SETTING_KEYS.autoAssignExcludeStaffIds,
  );
  const staleNewHoursDb = map.get(LEAD_SETTING_KEYS.staleNewLeadHours);
  const routingRulesDb = map.get(LEAD_SETTING_KEYS.routingRulesJson);
  const callOutcomeMatrixDb = map.get(LEAD_SETTING_KEYS.callOutcomeMatrixJson);
  const requireCallOutcomeDb = map.get(
    LEAD_SETTING_KEYS.requireCallOutcomeBeforeClose,
  );
  const createLeadOnStartDb = map.get(
    LEAD_SETTING_KEYS.createLeadOnAssessmentStart,
  );
  const pauseSystemLeadDb = map.get(LEAD_SETTING_KEYS.pauseSystemLeadCreation);
  const adminOverdueSmsDb = map.get(
    LEAD_SETTING_KEYS.adminOverdueFollowUpSmsEnabled,
  );

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
    assessmentIncompleteAfterHours:
      incompleteHoursDb !== undefined
        ? Number.parseInt(incompleteHoursDb, 10)
        : env.leadAssessmentIncompleteAfterHours,
    autoAssignExcludeStaffIds: parseStaffIdList(excludeStaffIdsDb),
    staleNewLeadHours: (() => {
      if (staleNewHoursDb === undefined) {
        return DEFAULT_STALE_NEW_LEAD_HOURS;
      }
      const parsed = Number.parseInt(staleNewHoursDb, 10);
      return Number.isInteger(parsed) && parsed >= 1
        ? parsed
        : DEFAULT_STALE_NEW_LEAD_HOURS;
    })(),
    routingRules: parseRoutingRulesJson(routingRulesDb),
    callOutcomeMatrix: parseCallOutcomeMatrixJson(callOutcomeMatrixDb),
    requireCallOutcomeBeforeClose: parseBoolSetting(requireCallOutcomeDb, false),
    createLeadOnAssessmentStart: parseBoolSetting(createLeadOnStartDb, true),
    pauseSystemLeadCreation: parseBoolSetting(pauseSystemLeadDb, false),
    adminOverdueFollowUpSmsEnabled: parseBoolSetting(adminOverdueSmsDb, true),
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

  if (input.assessmentIncompleteAfterHours !== undefined) {
    assertValidDelayHours(
      input.assessmentIncompleteAfterHours,
      "assessmentIncompleteAfterHours",
    );
    await upsertSetting(
      LEAD_SETTING_KEYS.assessmentIncompleteAfterHours,
      String(input.assessmentIncompleteAfterHours),
    );
  }

  if (input.maxOpenLeadsPerExpert !== undefined) {
    assertValidMaxOpenLeads(input.maxOpenLeadsPerExpert);
    await upsertSetting(
      LEAD_SETTING_KEYS.maxOpenLeadsPerExpert,
      String(input.maxOpenLeadsPerExpert),
    );
  }

  if (input.staleNewLeadHours !== undefined) {
    assertValidStaleNewLeadHours(input.staleNewLeadHours);
    await upsertSetting(
      LEAD_SETTING_KEYS.staleNewLeadHours,
      String(input.staleNewLeadHours),
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

  if (input.autoAssignExcludeStaffIds !== undefined) {
    const ids = [
      ...new Set(
        input.autoAssignExcludeStaffIds
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    for (const id of ids) {
      const staff = await findStaffUserById(id);
      if (!staff || staff.role !== "sales_expert") {
        throw new AppError(
          "VALIDATION_ERROR",
          "autoAssignExcludeStaffIds must contain sales expert IDs",
          400,
        );
      }
    }
    if (ids.length === 0) {
      await deleteSetting(LEAD_SETTING_KEYS.autoAssignExcludeStaffIds);
    } else {
      await upsertSetting(
        LEAD_SETTING_KEYS.autoAssignExcludeStaffIds,
        serializeStaffIdList(ids),
      );
    }
  }

  if (input.routingRules !== undefined) {
    const rules = normalizeRoutingRules(input.routingRules);
    for (const staffId of Object.values(rules.preferAssigneeBySource)) {
      if (!staffId) continue;
      const staff = await findStaffUserById(staffId);
      if (!staff || !staff.isActive || staff.role !== "sales_expert") {
        throw new AppError(
          "VALIDATION_ERROR",
          "preferAssigneeBySource must reference an active sales expert",
          400,
        );
      }
    }
    await upsertSetting(
      LEAD_SETTING_KEYS.routingRulesJson,
      JSON.stringify(rules),
    );
  }

  if (input.callOutcomeMatrix !== undefined) {
    const matrix = normalizeCallOutcomeMatrix(input.callOutcomeMatrix);
    await upsertSetting(
      LEAD_SETTING_KEYS.callOutcomeMatrixJson,
      JSON.stringify(matrix),
    );
  }

  if (input.requireCallOutcomeBeforeClose !== undefined) {
    await upsertSetting(
      LEAD_SETTING_KEYS.requireCallOutcomeBeforeClose,
      input.requireCallOutcomeBeforeClose ? "true" : "false",
    );
  }

  if (input.createLeadOnAssessmentStart !== undefined) {
    await upsertSetting(
      LEAD_SETTING_KEYS.createLeadOnAssessmentStart,
      input.createLeadOnAssessmentStart ? "true" : "false",
    );
  }

  if (input.pauseSystemLeadCreation !== undefined) {
    await upsertSetting(
      LEAD_SETTING_KEYS.pauseSystemLeadCreation,
      input.pauseSystemLeadCreation ? "true" : "false",
    );
  }

  if (input.adminOverdueFollowUpSmsEnabled !== undefined) {
    await upsertSetting(
      LEAD_SETTING_KEYS.adminOverdueFollowUpSmsEnabled,
      input.adminOverdueFollowUpSmsEnabled ? "true" : "false",
    );
  }

  return getLeadSettings();
}
