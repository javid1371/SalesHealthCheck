import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  SALES_EXPERT_SESSION_COOKIE,
  parseAdminSessionCookie,
  parseSalesExpertSessionCookie,
} from "@/lib/session";
import {
  getConsultationLeadDetail,
  updateConsultationLeadStatus,
} from "@/modules/consultation/consultation.service";
import { validateUpdateConsultationLeadRequest } from "@/modules/consultation/consultation-lead.validators";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function readConsultationAccess(request: NextRequest) {
  return {
    adminSession: parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    ),
    salesExpertSession: parseSalesExpertSessionCookie(
      request.cookies.get(SALES_EXPERT_SESSION_COOKIE)?.value,
    ),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const access = readConsultationAccess(request);
    const { id } = await context.params;
    const lead = await getConsultationLeadDetail(id, access);
    return { lead };
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const access = readConsultationAccess(request);
    const { id } = await context.params;
    const body = await request.json();
    const input = validateUpdateConsultationLeadRequest(body);
    const lead = await updateConsultationLeadStatus(id, input, access);
    return { lead };
  });
}
