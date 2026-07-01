import { normalizePhone } from "@/modules/auth/auth.validators";
import {
  createUserWithPhone,
  findLatestUserByPhone,
  markPhoneVerified,
} from "@/modules/auth/otp.repository";

export async function resolveUserFromContactPhone(phone: string): Promise<{
  userId: string;
  normalizedPhone: string;
}> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("invalid_phone");
  }

  let user = await findLatestUserByPhone(normalizedPhone);
  if (!user) {
    user = await createUserWithPhone(normalizedPhone);
  }

  if (!user.phoneVerifiedAt) {
    await markPhoneVerified(user.id);
  }

  return {
    userId: user.id,
    normalizedPhone,
  };
}
