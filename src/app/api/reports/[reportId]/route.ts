import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readSessionsFromRequest } from "@/lib/session";
import { getReport } from "@/modules/assessment/assessment.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const { userSession, adminSession, salesExpertSession } =
    readSessionsFromRequest(request);

  return handleApiRequest(() =>
    getReport(reportId, {
      token,
      userSession,
      adminSession,
      salesExpertSession,
    }),
  );
}
