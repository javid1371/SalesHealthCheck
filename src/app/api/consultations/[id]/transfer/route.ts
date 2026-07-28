import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  SALES_EXPERT_SESSION_COOKIE,
  parseAdminSessionCookie,
  parseSalesExpertSessionCookie,
} from "@/lib/session";
import { transferLead } from "@/modules/consultation/consultation.service";
import { validateTransferLeadRequest } from "@/modules/consultation/consultation-lead.validators";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const access = {
      adminSession: parseAdminSessionCookie(
        request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
      ),
      salesExpertSession: parseSalesExpertSessionCookie(
        request.cookies.get(SALES_EXPERT_SESSION_COOKIE)?.value,
      ),
    };

    const { id } = await context.params;
    const body = await request.json();
    const input = validateTransferLeadRequest(body);
    const lead = await transferLead(id, input, access);

    return { lead };
  });
}
