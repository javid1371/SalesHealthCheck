import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import { setStaffUserActiveByAdmin } from "@/modules/staff/staff.service";
import { validateSetStaffUserActiveRequest } from "@/modules/staff/staff.validators";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const { id } = await context.params;
    const body = await request.json();
    const { isActive } = validateSetStaffUserActiveRequest(body);

    const user = await setStaffUserActiveByAdmin(
      id,
      isActive,
      session.staffUserId ?? id,
    );

    return { user };
  });
}
