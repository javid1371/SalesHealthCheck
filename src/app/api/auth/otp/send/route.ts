import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { getClientIp } from "@/lib/request-ip";
import { sendOtp } from "@/modules/auth/auth.service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleApiRequest(() =>
    sendOtp(body, { ip: getClientIp(request) }),
  );
}
