import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import { validateBulkUpdateLeadsRequest } from "@/modules/consultation/consultation-lead.validators";
import { bulkUpdateLeads } from "@/modules/consultation/consultation.service";

export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = await request.json();
    const input = validateBulkUpdateLeadsRequest(body);
    const result = await bulkUpdateLeads(input, { adminSession: session });
    return result;
  });
}
