import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { parseUserSessionCookie, USER_SESSION_COOKIE } from "@/lib/session";
import { listMyAssessments } from "@/modules/account/account.service";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseUserSessionCookie(
      request.cookies.get(USER_SESSION_COOKIE)?.value,
    );

    if (!session) {
      throw new AppError(
        "UNAUTHORIZED",
        "برای مشاهده تست‌ها ابتدا وارد شوید.",
        401,
      );
    }

    return listMyAssessments(session.userId);
  });
}
