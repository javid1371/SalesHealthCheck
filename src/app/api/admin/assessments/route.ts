import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import {
  listAssessments,
  requireAdminSession,
} from "@/modules/admin/admin.service";
import { validateAdminAssessmentFilter } from "@/modules/admin/admin.validators";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const filter = validateAdminAssessmentFilter(request.nextUrl.searchParams);
    return listAssessments(filter);
  });
}
