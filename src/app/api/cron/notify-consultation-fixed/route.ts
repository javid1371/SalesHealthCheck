import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { notifyFailedConsultationUsers } from "@/modules/consultation/fix-notification.service";

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

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const result = await notifyFailedConsultationUsers({ dryRun });
  return NextResponse.json(result);
}
