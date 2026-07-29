import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { env } from "@/lib/env";
import { isWithinSmsQuietHours } from "@/modules/sms-funnel/quiet-hours";
import {
  findStaffNamesByIds,
  listActiveAdminsWithPhone,
  listActiveSalesExpertsWithPhone,
} from "@/modules/staff/staff.repository";
import {
  countFollowUpsDueByAssignee,
  countOverdueFollowUpsByAssignee,
  deleteStaffReminderLog,
  tryCreateStaffReminderLog,
} from "./consultation.repository";
import { getLeadSettings } from "./lead-config.service";

/** Morning digest send window in Asia/Tehran (hour start inclusive, end exclusive). */
export const FOLLOW_UP_DIGEST_WINDOW = { start: 9, end: 11 } as const;

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const EXPERT_REMINDER_TYPE = "follow_up_digest" as const;
const ADMIN_REMINDER_TYPE = "admin_overdue_digest" as const;
const ADMIN_BREAKDOWN_LIMIT = 5;

export type FollowUpReminderDigestResult = {
  sent: number;
  skippedQuietHours: boolean;
  skippedAlreadySent: number;
  skippedNoDue: number;
  failed: number;
  admin: AdminOverdueDigestResult;
};

export type AdminOverdueDigestResult = {
  sent: number;
  skippedDisabled: boolean;
  skippedQuietHours: boolean;
  skippedAlreadySent: number;
  skippedNoOverdue: boolean;
  skippedNoAdmins: boolean;
  failed: number;
};

function endOfLocalDay(date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Calendar day in Asia/Tehran as a UTC midnight Date for `@db.Date`. */
export function tehranCalendarDate(date = new Date()): Date {
  const tehran = new Date(date.getTime() + TEHRAN_OFFSET_MS);
  const y = tehran.getUTCFullYear();
  const m = tehran.getUTCMonth();
  const d = tehran.getUTCDate();
  return new Date(Date.UTC(y, m, d));
}

export function buildExpertFollowUpListUrl(): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  return `${base}/expert/consultations?onlyFollowUpDueToday=true`;
}

export function buildAdminOverdueFollowUpListUrl(): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  return `${base}/admin/ops`;
}

export function renderFollowUpDigestSms(input: {
  dueCount: number;
  overdueCount: number;
  listUrl: string;
}): string {
  return `امروز ${input.dueCount} پیگیری دارید (از جمله ${input.overdueCount} عقب‌افتاده). لیست: ${input.listUrl}`;
}

export function renderAdminOverdueDigestSms(input: {
  total: number;
  byExpert: { name: string; count: number }[];
  listUrl: string;
}): string {
  if (input.byExpert.length === 1) {
    const only = input.byExpert[0]!;
    return `پیگیری عقب‌افتاده نزد ${only.name}: ${only.count} مورد — ${input.listUrl}`;
  }

  const shown = input.byExpert.slice(0, ADMIN_BREAKDOWN_LIMIT);
  const parts = shown.map((row) => `${row.name} ${row.count}`).join("، ");
  const remaining = input.byExpert.length - shown.length;
  const more =
    remaining > 0 ? ` و ${remaining} کارشناس دیگر` : "";

  return `${input.total} پیگیری عقب‌افتاده (${parts}${more}) — ${input.listUrl}`;
}

function emptyAdminResult(
  overrides: Partial<AdminOverdueDigestResult> = {},
): AdminOverdueDigestResult {
  return {
    sent: 0,
    skippedDisabled: false,
    skippedQuietHours: false,
    skippedAlreadySent: 0,
    skippedNoOverdue: false,
    skippedNoAdmins: false,
    failed: 0,
    ...overrides,
  };
}

export async function processAdminOverdueFollowUpDigests(
  now = new Date(),
): Promise<AdminOverdueDigestResult> {
  if (!isWithinSmsQuietHours(now, FOLLOW_UP_DIGEST_WINDOW)) {
    return emptyAdminResult({ skippedQuietHours: true });
  }

  const settings = await getLeadSettings();
  if (!settings.adminOverdueFollowUpSmsEnabled) {
    return emptyAdminResult({ skippedDisabled: true });
  }

  const overdueRows = await countOverdueFollowUpsByAssignee(now);
  const total = overdueRows.reduce((sum, row) => sum + row.count, 0);
  if (total < 1) {
    return emptyAdminResult({ skippedNoOverdue: true });
  }

  const admins = await listActiveAdminsWithPhone();
  if (admins.length === 0) {
    return emptyAdminResult({ skippedNoAdmins: true });
  }

  const nameById = await findStaffNamesByIds(
    overdueRows.map((row) => row.assignedToId),
  );
  const byExpert = overdueRows
    .map((row) => ({
      name: nameById.get(row.assignedToId) ?? "کارشناس",
      count: row.count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fa"));

  const reminderDate = tehranCalendarDate(now);
  const listUrl = buildAdminOverdueFollowUpListUrl();
  const body = renderAdminOverdueDigestSms({ total, byExpert, listUrl });
  const sender = await createSmsSenderFromSettings();

  let sent = 0;
  let skippedAlreadySent = 0;
  let failed = 0;

  for (const admin of admins) {
    const claimed = await tryCreateStaffReminderLog({
      staffUserId: admin.id,
      date: reminderDate,
      type: ADMIN_REMINDER_TYPE,
    });
    if (!claimed) {
      skippedAlreadySent += 1;
      continue;
    }

    try {
      await sender.sendMessage(admin.phone, body);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[follow-up-reminder] failed to send admin overdue digest SMS:",
        admin.id,
        error,
      );
      await deleteStaffReminderLog({
        staffUserId: admin.id,
        date: reminderDate,
        type: ADMIN_REMINDER_TYPE,
      });
    }
  }

  return emptyAdminResult({
    sent,
    skippedAlreadySent,
    failed,
  });
}

export async function processFollowUpReminderDigests(
  now = new Date(),
): Promise<FollowUpReminderDigestResult> {
  if (!isWithinSmsQuietHours(now, FOLLOW_UP_DIGEST_WINDOW)) {
    return {
      sent: 0,
      skippedQuietHours: true,
      skippedAlreadySent: 0,
      skippedNoDue: 0,
      failed: 0,
      admin: emptyAdminResult({ skippedQuietHours: true }),
    };
  }

  const endOfToday = endOfLocalDay(now);
  const reminderDate = tehranCalendarDate(now);
  const listUrl = buildExpertFollowUpListUrl();

  const [experts, dueRows, overdueRows] = await Promise.all([
    listActiveSalesExpertsWithPhone(),
    countFollowUpsDueByAssignee(endOfToday),
    countOverdueFollowUpsByAssignee(now),
  ]);

  const dueByExpert = new Map(
    dueRows.map((row) => [row.assignedToId, row.count]),
  );
  const overdueByExpert = new Map(
    overdueRows.map((row) => [row.assignedToId, row.count]),
  );

  let sent = 0;
  let skippedAlreadySent = 0;
  let skippedNoDue = 0;
  let failed = 0;

  const sender = await createSmsSenderFromSettings();

  for (const expert of experts) {
    const dueCount = dueByExpert.get(expert.id) ?? 0;
    if (dueCount < 1) {
      skippedNoDue += 1;
      continue;
    }

    const claimed = await tryCreateStaffReminderLog({
      staffUserId: expert.id,
      date: reminderDate,
      type: EXPERT_REMINDER_TYPE,
    });
    if (!claimed) {
      skippedAlreadySent += 1;
      continue;
    }

    const overdueCount = overdueByExpert.get(expert.id) ?? 0;
    const body = renderFollowUpDigestSms({
      dueCount,
      overdueCount,
      listUrl,
    });

    try {
      await sender.sendMessage(expert.phone, body);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[follow-up-reminder] failed to send digest SMS:",
        expert.id,
        error,
      );
      // Release claim so a later cron tick in the window can retry.
      await deleteStaffReminderLog({
        staffUserId: expert.id,
        date: reminderDate,
        type: EXPERT_REMINDER_TYPE,
      });
    }
  }

  const admin = await processAdminOverdueFollowUpDigests(now);

  return {
    sent,
    skippedQuietHours: false,
    skippedAlreadySent,
    skippedNoDue,
    failed,
    admin,
  };
}
