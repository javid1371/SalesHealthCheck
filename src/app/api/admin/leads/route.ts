import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import { validateCreateManualLeadRequest } from "@/modules/consultation/consultation-lead.validators";
import { createManualLead } from "@/modules/consultation/consultation.service";

export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const body = await request.json();
    const input = validateCreateManualLeadRequest(body);
    const lead = await createManualLead(input, { adminSession: session });
    return { lead };
  });
}
