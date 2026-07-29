import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  getMessengerLabelsForAdmin,
  saveMessengerLabels,
} from "@/modules/messenger/messenger-labels-admin.service";
import type { MessengerLabelUpdate } from "@/modules/messenger/messenger-labels.repository";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const data = await getMessengerLabelsForAdmin();
    return data;
  });
}

export async function PATCH(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = (await request.json()) as {
      updates?: MessengerLabelUpdate[];
    };
    const result = await saveMessengerLabels(body.updates ?? []);
    return result;
  });
}
