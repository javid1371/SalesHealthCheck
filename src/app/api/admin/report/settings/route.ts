import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  getReportSettings,
  updateReportSettings,
  type UpdateReportSettingsInput,
} from "@/modules/report/report-config.service";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const settings = await getReportSettings();
    return { settings };
  });
}

export async function PATCH(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = (await request.json()) as UpdateReportSettingsInput;
    const settings = await updateReportSettings(body);
    return { settings };
  });
}
