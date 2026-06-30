import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { errorResponse, isAppError, AppError } from "@/lib/errors";
import { readSessionsFromRequest } from "@/lib/session";
import { generateReportPdf } from "@/modules/report/report-pdf.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    const { userSession, adminSession, salesExpertSession } =
      readSessionsFromRequest(request);
    const pdf = await generateReportPdf(reportId, {
      token,
      userSession,
      adminSession,
      salesExpertSession,
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sales-health-check-${reportId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return errorResponse(error);
    }

    console.error("Unhandled PDF API error:", error);
    Sentry.captureException(error);

    return errorResponse(
      new AppError(
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        500,
      ),
    );
  }
}
