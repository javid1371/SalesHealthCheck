import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readSessionsFromRequest } from "@/lib/session";
import { captureSnapshot } from "@/modules/sales-funnel/sales-funnel.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const { userSession, adminSession, salesExpertSession } =
    readSessionsFromRequest(request);

  return handleApiRequest(() =>
    captureSnapshot(id, {
      token,
      userSession,
      adminSession,
      salesExpertSession,
    }),
  );
}
