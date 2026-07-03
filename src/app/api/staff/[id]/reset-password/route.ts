import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import { resetStaffUserPasswordByAdmin } from "@/modules/staff/staff.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const { id } = await context.params;
    const body = await request.json();
    const result = await resetStaffUserPasswordByAdmin(id, body);

    return result;
  });
}
