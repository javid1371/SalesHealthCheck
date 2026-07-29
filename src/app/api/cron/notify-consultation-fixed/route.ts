import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import {
  AUTOMATION_HEARTBEAT_KEYS,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";
import { notifyFailedConsultationUsers } from "@/modules/consultation/fix-notification.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = AUTOMATION_HEARTBEAT_KEYS.notifyConsultationFixed;

  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1";

    const result = await notifyFailedConsultationUsers({ dryRun });
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
