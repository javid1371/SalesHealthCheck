import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueueSmsFunnelJob } from "@/modules/sms-funnel/sms-funnel.queue";

export const dynamic = "force-dynamic";

function assertCronAuth(request: Request): void {
  const secret = env.smsFunnelCronSecret;
  if (!secret) {
    throw new Error("SMS_FUNNEL_CRON_SECRET is not configured");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new Error("Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ requeued, checked: stale.length });
}
