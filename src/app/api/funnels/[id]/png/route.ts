import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { errorResponse, isAppError, AppError } from "@/lib/errors";
import { readSessionsFromRequest } from "@/lib/session";
import { generateFunnelChartImage } from "@/modules/sales-funnel/sales-funnel-image.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get("token");
    const { userSession, adminSession, salesExpertSession } =
      readSessionsFromRequest(request);
    const png = await generateFunnelChartImage(id, {
      token,
      userSession,
      adminSession,
      salesExpertSession,
    });

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="sales-funnel-${id}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return errorResponse(error);
    }

    console.error("Unhandled funnel PNG API error:", error);
    Sentry.captureException(error);

    return errorResponse(
      new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500),
    );
  }
}
