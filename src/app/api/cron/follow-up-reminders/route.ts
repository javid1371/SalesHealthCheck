import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import {
  AUTOMATION_HEARTBEAT_KEYS,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";
import { processFollowUpReminderDigests } from "@/modules/consultation/follow-up-reminder.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = AUTOMATION_HEARTBEAT_KEYS.followUpReminders;

  try {
    const result = await processFollowUpReminderDigests();
    await recordAutomationSuccess(key);
    return NextResponse.json(result);
  } catch (error) {
    await recordAutomationFailure(key, error);
    return NextResponse.json(
      { error: "cron_failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
