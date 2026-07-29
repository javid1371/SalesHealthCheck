import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import {
  AUTOMATION_HEARTBEAT_KEYS,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";
import { backfillAssessmentLeads } from "@/modules/consultation/lead-backfill.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = AUTOMATION_HEARTBEAT_KEYS.leadBackfill;

  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const groupParam = url.searchParams.get("group") ?? "all";
    const limitParam = url.searchParams.get("limit");
    const group =
      groupParam === "active" ||
      groupParam === "completed" ||
      groupParam === "abandoned" ||
      groupParam === "all"
        ? groupParam
        : "all";
    const limit = limitParam
      ? Number.parseInt(limitParam, 10)
      : undefined;

    const result = await backfillAssessmentLeads({
      group,
      dryRun,
      limit:
        limit !== undefined && Number.isFinite(limit) && limit > 0
          ? limit
          : undefined,
    });

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
