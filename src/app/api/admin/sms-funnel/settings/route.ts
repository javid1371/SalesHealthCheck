import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  updateFunnelSettings,
  type UpdateFunnelSettingsInput,
} from "@/modules/sms-funnel/funnel-config.service";

export async function PATCH(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = (await request.json()) as UpdateFunnelSettingsInput;
    const settings = await updateFunnelSettings(body);
    return { settings };
  });
}
