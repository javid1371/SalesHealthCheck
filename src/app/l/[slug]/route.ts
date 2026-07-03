import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  createFunnelEvent,
  findShortLinkBySlug,
  incrementShortLinkClick,
} from "@/modules/sms-funnel/funnel.repository";
import { hookConsultationStarted, hookReportViewed } from "@/modules/sms-funnel/hooks";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const link = await findShortLinkBySlug(slug);

  if (!link) {
    return NextResponse.redirect(new URL("/", env.appBaseUrl));
  }

  await incrementShortLinkClick(slug);
  await createFunnelEvent({
    userId: link.userId ?? undefined,
    assessmentSessionId: link.assessmentSessionId ?? undefined,
    type: "link_clicked",
    metadata: {
      slug,
      purpose: link.purpose,
    },
  });

  if (link.purpose === "result" && link.userId && link.assessmentSessionId) {
    await createFunnelEvent({
      userId: link.userId,
      assessmentSessionId: link.assessmentSessionId,
      type: "report_viewed",
    });
    hookReportViewed(link.userId, link.assessmentSessionId);
  }

  if (link.purpose === "consultation" && link.userId && link.assessmentSessionId) {
    await createFunnelEvent({
      userId: link.userId,
      assessmentSessionId: link.assessmentSessionId,
      type: "consultation_started",
    });
    hookConsultationStarted(link.userId, link.assessmentSessionId);
  }

  return NextResponse.redirect(link.targetUrl);
}
