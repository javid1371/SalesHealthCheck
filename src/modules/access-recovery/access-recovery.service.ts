import { env } from "@/lib/env";
import { findUserByEmailOrPhone } from "@/modules/assessment/assessment.repository";
import { buildResultUrl } from "@/modules/assessment/assessment.validators";
import { sendRecoveryEmail } from "./access-recovery.email";
import { findLatestCompletedSession } from "./access-recovery.repository";
import type {
  RecoverAccessInput,
  RecoverAccessResponse,
} from "./access-recovery.types";
import { RECOVER_ACCESS_SUCCESS_MESSAGE } from "./access-recovery.types";
import { validateRecoverAccessRequest } from "./access-recovery.validators";

export { RECOVER_ACCESS_SUCCESS_MESSAGE } from "./access-recovery.types";

export async function recoverAccess(
  body: unknown,
): Promise<RecoverAccessResponse> {
  const input: RecoverAccessInput = validateRecoverAccessRequest(body);

  const user = await findUserByEmailOrPhone(input.email, input.phone);
  if (!user) {
    return { message: RECOVER_ACCESS_SUCCESS_MESSAGE };
  }

  const session = await findLatestCompletedSession(user.id);
  if (!session) {
    return { message: RECOVER_ACCESS_SUCCESS_MESSAGE };
  }

  const emailTo = input.email ?? user.email;
  if (!emailTo) {
    return { message: RECOVER_ACCESS_SUCCESS_MESSAGE };
  }

  const baseUrl = env.appBaseUrl.replace(/\/$/, "");
  const resultUrl = `${baseUrl}${buildResultUrl(session.id, session.resultToken)}`;

  await sendRecoveryEmail({ to: emailTo, resultUrl });

  return { message: RECOVER_ACCESS_SUCCESS_MESSAGE };
}
