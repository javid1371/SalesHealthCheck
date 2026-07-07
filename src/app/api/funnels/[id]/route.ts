import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readSessionsFromRequest } from "@/lib/session";
import {
  deleteFunnel,
  getFunnel,
  updateFunnel,
} from "@/modules/sales-funnel/sales-funnel.service";
import { validateUpdateFunnelRequest } from "@/modules/sales-funnel/sales-funnel.validators";

type RouteContext = { params: Promise<{ id: string }> };

function readFunnelAccess(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const { userSession, adminSession, salesExpertSession } =
    readSessionsFromRequest(request);

  return {
    token,
    userSession,
    adminSession,
    salesExpertSession,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return handleApiRequest(() =>
    getFunnel(id, readFunnelAccess(request)),
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();

  return handleApiRequest(async () => {
    const input = validateUpdateFunnelRequest(body);
    return updateFunnel(id, input, readFunnelAccess(request));
  });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return handleApiRequest(async () => {
    await deleteFunnel(id, readFunnelAccess(request));
    return { deleted: true };
  });
}
