import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { normalizePhone } from "@/modules/auth/auth.validators";
import {
  addPhoneOptOut,
  createFunnelEvent,
  stopEnrollmentsForUser,
} from "@/modules/sms-funnel/funnel.repository";

export async function POST(request: Request) {
  return handleApiRequest(async () => {
    const body = (await request.json()) as { phone?: string };
    const phone = normalizePhone(body.phone ?? "");
    if (!phone) {
      throw new AppError("VALIDATION_ERROR", "Invalid phone number", 400);
    }

    await addPhoneOptOut(phone);
    await createFunnelEvent({
      type: "opt_out",
      metadata: { phone },
    });

    const users = await db.user.findMany({
      where: { phone },
      select: { id: true },
    });

    for (const user of users) {
      await stopEnrollmentsForUser({
        userId: user.id,
        status: "stopped",
      });
    }

    return { ok: true };
  });
}
