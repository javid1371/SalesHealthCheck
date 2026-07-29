import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import {
  AUTOMATION_HEARTBEAT_KEYS,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";
import { enqueueSmsFunnelJob } from "@/modules/sms-funnel/sms-funnel.queue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = AUTOMATION_HEARTBEAT_KEYS.smsFunnel;

  try {
    const now = new Date();
    const stale = await db.smsMessage.findMany({
      where: {
        status: "pending",
        scheduledFor: { lte: now },
      },
      take: 100,
      select: {
        id: true,
        dedupeKey: true,
        enrollmentId: true,
        sequenceKey: true,
        stepKey: true,
      },
    });

    let requeued = 0;
    for (const row of stale) {
      await enqueueSmsFunnelJob(
        {
          enrollmentId: row.enrollmentId,
          sequenceKey: row.sequenceKey,
          stepKey: row.stepKey,
          dedupeKey: row.dedupeKey,
          smsMessageId: row.id,
        },
        0,
      );
      requeued += 1;
    }

    await recordAutomationSuccess(key);
    return NextResponse.json({ requeued, checked: stale.length });
  } catch (error) {
    await recordAutomationFailure(key, error);
    return NextResponse.json(
      { error: "cron_failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
