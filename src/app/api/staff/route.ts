import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  createStaffUserByAdmin,
  listStaffUsers,
} from "@/modules/staff/staff.service";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const users = await listStaffUsers();
    return { users };
  });
}

export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = await request.json();
    const user = await createStaffUserByAdmin(body);
    return { user };
  });
}
