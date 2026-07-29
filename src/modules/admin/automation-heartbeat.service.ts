import { db } from "@/lib/db";

export const AUTOMATION_HEARTBEAT_KEYS = {
  leadAssignment: "lead-assignment",
  smsFunnel: "sms-funnel",
  followUpReminders: "follow-up-reminders",
  leadBackfill: "lead-backfill",
  notifyConsultationFixed: "notify-consultation-fixed",
} as const;

export type AutomationHeartbeatKey =
  (typeof AUTOMATION_HEARTBEAT_KEYS)[keyof typeof AUTOMATION_HEARTBEAT_KEYS];

const HEARTBEAT_LABELS: Record<AutomationHeartbeatKey, string> = {
  "lead-assignment": "تخصیص لید",
  "sms-funnel": "قیف پیامکی",
  "follow-up-reminders": "یادآور پیگیری",
  "lead-backfill": "بک‌فیل لید",
  "notify-consultation-fixed": "اعلان رفع خطای مشاوره",
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

export async function recordAutomationSuccess(
  key: AutomationHeartbeatKey,
): Promise<void> {
  const now = new Date();
  await db.automationHeartbeat.upsert({
    where: { key },
    create: {
      key,
      lastSuccessAt: now,
      lastError: null,
      lastErrorAt: null,
    },
    update: {
      lastSuccessAt: now,
      lastError: null,
    },
  });
}

export async function recordAutomationFailure(
  key: AutomationHeartbeatKey,
  error: unknown,
): Promise<void> {
  const now = new Date();
  await db.automationHeartbeat.upsert({
    where: { key },
    create: {
      key,
      lastErrorAt: now,
      lastError: errorMessage(error),
    },
    update: {
      lastErrorAt: now,
      lastError: errorMessage(error),
    },
  });
}

export async function listAutomationHeartbeats() {
  const rows = await db.automationHeartbeat.findMany({
    orderBy: { key: "asc" },
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));

  return (Object.keys(HEARTBEAT_LABELS) as AutomationHeartbeatKey[]).map(
    (key) => {
      const row = byKey.get(key);
      return {
        key,
        label: HEARTBEAT_LABELS[key],
        lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
        lastErrorAt: row?.lastErrorAt?.toISOString() ?? null,
        lastError: row?.lastError ?? null,
      };
    },
  );
}
