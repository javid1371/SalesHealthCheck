import type { NextRequest } from "next/server";
import { AppError, errorResponse, isAppError } from "@/lib/errors";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import { validateConsultationListFilter } from "@/modules/consultation/consultation-list.validators";
import { exportLeadsToCsv } from "@/modules/consultation/consultation.service";

export async function GET(request: NextRequest) {
  try {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const filter = validateConsultationListFilter(request.nextUrl.searchParams);
    const csv = await exportLeadsToCsv(filter, { adminSession: session });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads-export.csv"',
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return errorResponse(error);
    }

    console.error("Lead export error:", error);
    return errorResponse(
      new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500),
    );
  }
}
