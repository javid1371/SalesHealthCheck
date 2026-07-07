import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { parseUserSessionCookie, USER_SESSION_COOKIE } from "@/lib/session";
import {
  createFunnel,
  listUserFunnels,
} from "@/modules/sales-funnel/sales-funnel.service";
import { validateCreateFunnelRequest } from "@/modules/sales-funnel/sales-funnel.validators";

function requireUserSession(request: NextRequest) {
  const session = parseUserSessionCookie(
    request.cookies.get(USER_SESSION_COOKIE)?.value,
  );

  if (!session) {
    throw new AppError(
      "UNAUTHORIZED",
      "برای مدیریت قیف فروش ابتدا وارد شوید.",
      401,
    );
  }

  return session;
}

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = requireUserSession(request);
    return listUserFunnels(session);
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  return handleApiRequest(async () => {
    const session = requireUserSession(request);
    const input = validateCreateFunnelRequest(body);
    return createFunnel({ userId: session.userId }, input);
  });
}
