import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { backfillAssessmentLeads } from "@/modules/consultation/lead-backfill.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  return NextResponse.json(result);
}
