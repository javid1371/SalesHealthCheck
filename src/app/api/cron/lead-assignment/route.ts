import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueSystemLeadAssignments } from "@/modules/consultation/lead-assignment.service";

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

  const processed = await processDueSystemLeadAssignments();
  return NextResponse.json({ processed });
}
