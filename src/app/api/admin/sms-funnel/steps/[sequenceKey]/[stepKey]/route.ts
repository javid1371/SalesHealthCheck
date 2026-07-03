import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  updateStepConfig,
  type UpdateStepConfigInput,
} from "@/modules/sms-funnel/funnel-config.service";
import { FUNNEL_SEQUENCES, type SequenceKey } from "@/modules/sms-funnel/sequences";

function parseSequenceKey(value: string): SequenceKey {
  if (!(value in FUNNEL_SEQUENCES)) {
    throw new AppError("VALIDATION_ERROR", "Invalid sequence key", 400);
  }
  return value as SequenceKey;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceKey: string; stepKey: string }> },
) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const { sequenceKey: rawSequenceKey, stepKey } = await params;
    const sequenceKey = parseSequenceKey(rawSequenceKey);
    const body = (await request.json()) as UpdateStepConfigInput;

    const step = await updateStepConfig(sequenceKey, stepKey, body);
    return { step };
  });
}
