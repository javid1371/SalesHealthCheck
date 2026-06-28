import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitResponse, recoverAccessLimiter } from "@/lib/rate-limit";
import { recoverAccess } from "@/modules/access-recovery/access-recovery.service";

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSec } = recoverAccessLimiter(getClientIp(request));

  if (!allowed) {
    return rateLimitResponse(retryAfterSec);
  }

  const body = await request.json();
  return handleApiRequest(() => recoverAccess(body));
}
