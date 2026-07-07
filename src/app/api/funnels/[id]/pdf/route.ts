import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { errorResponse, isAppError, AppError } from "@/lib/errors";
import { readSessionsFromRequest } from "@/lib/session";
import { generateFunnelPdf } from "@/modules/sales-funnel/sales-funnel-pdf.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get("token");
    const { userSession, adminSession, salesExpertSession } =
      readSessionsFromRequest(request);
    const pdf = await generateFunnelPdf(id, {
      token,
      userSession,
      adminSession,
      salesExpertSession,
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sales-funnel-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return errorResponse(error);
    }

    console.error("Unhandled funnel PDF API error:", error);
    Sentry.captureException(error);

    return errorResponse(
      new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500),
    );
  }
}
