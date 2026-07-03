import {
  createHash,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import {
  checkOtpSendRateLimit,
} from "@/lib/rate-limit";
import {
  OTP_SEND_SUCCESS_MESSAGE,
  OTP_VERIFY_INVALID_MESSAGE,
  type SendOtpResponse,
  type VerifyOtpResult,
} from "./auth.types";
import {
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} from "./auth.validators";
import {
  consumeActiveOtpCodesForPhone,
  consumeOtpCode,
  createOtpCode,
  createUserWithPhone,
  findLatestActiveOtpCode,
  findLatestUserByPhone,
  incrementOtpAttempts,
  markPhoneVerified,
} from "./otp.repository";
import { createSmsSender } from "./sms/kavenegar";

export {
  OTP_SEND_SUCCESS_MESSAGE,
  OTP_VERIFY_INVALID_MESSAGE,
} from "./auth.types";

function hashOtpCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${env.authSessionSecret}`)
    .digest("hex");
}

function verifyOtpHash(phone: string, code: string, codeHash: string): boolean {
  const computed = hashOtpCode(phone, code);
  const a = Buffer.from(computed);
  const b = Buffer.from(codeHash);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

function shouldExposeDevOtp(): boolean {
  return (
    env.nodeEnv !== "production" &&
    !(env.kavenegarApiKey && env.kavenegarOtpTemplate)
  );
}

function invalidOtpError(): AppError {
  return new AppError("UNAUTHORIZED", OTP_VERIFY_INVALID_MESSAGE, 401);
}

export type SendOtpOptions = {
  ip?: string;
};

export async function sendOtp(
  body: unknown,
  options?: SendOtpOptions,
): Promise<SendOtpResponse> {
  const input = validateSendOtpRequest(body);

  const rateLimit = checkOtpSendRateLimit(input.phone, options?.ip);
  if (!rateLimit.allowed) {
    throw new AppError(
      "VALIDATION_ERROR",
      "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.",
      429,
      { retry_after: rateLimit.retryAfterSec },
    );
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000);

  await consumeActiveOtpCodesForPhone(input.phone);
  await createOtpCode({
    phone: input.phone,
    codeHash: hashOtpCode(input.phone, code),
    expiresAt,
  });

  const smsSender = createSmsSender();
  try {
    await smsSender.sendOtp(input.phone, code);
  } catch (error) {
    console.error("Failed to send OTP SMS:", error);
  }

  return {
    message: OTP_SEND_SUCCESS_MESSAGE,
    ...(shouldExposeDevOtp() ? { devCode: code } : {}),
  };
}

export async function verifyOtp(body: unknown): Promise<VerifyOtpResult> {
  const input = validateVerifyOtpRequest(body);

  const otpRecord = await findLatestActiveOtpCode(input.phone);
  if (!otpRecord) {
    throw invalidOtpError();
  }

  if (otpRecord.attempts >= env.otpMaxAttempts) {
    throw invalidOtpError();
  }

  if (!verifyOtpHash(input.phone, input.code, otpRecord.codeHash)) {
    await incrementOtpAttempts(otpRecord.id);
    throw invalidOtpError();
  }

  await consumeOtpCode(otpRecord.id);

  const existingUser = await findLatestUserByPhone(input.phone);
  const user = existingUser ?? (await createUserWithPhone(input.phone));

  if (!user.phoneVerifiedAt) {
    await markPhoneVerified(user.id);
  }

  const { hookPhoneVerified } = await import("@/modules/sms-funnel/hooks");
  hookPhoneVerified(user.id);

  return { userId: user.id };
}
