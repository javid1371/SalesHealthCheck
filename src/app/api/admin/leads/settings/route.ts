import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  updateLeadSettings,
  type UpdateLeadSettingsInput,
} from "@/modules/consultation/lead-config.service";

export async function PATCH(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = (await request.json()) as UpdateLeadSettingsInput;
    const settings = await updateLeadSettings(body);
    return { settings };
  });
}
