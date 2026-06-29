import { db } from "@/lib/db";

export async function consumeActiveOtpCodesForPhone(phone: string) {
  await db.otpCode.updateMany({
    where: {
      phone,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });
}

export async function createOtpCode(data: {
  phone: string;
  codeHash: string;
  expiresAt: Date;
}) {
  return db.otpCode.create({
    data: {
      phone: data.phone,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
    },
  });
}

export async function findLatestActiveOtpCode(phone: string) {
  return db.otpCode.findFirst({
    where: {
      phone,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function incrementOtpAttempts(id: string) {
  return db.otpCode.update({
    where: { id },
    data: {
      attempts: { increment: 1 },
    },
  });
}

export async function consumeOtpCode(id: string) {
  return db.otpCode.update({
    where: { id },
    data: {
      consumedAt: new Date(),
    },
  });
}

export async function findLatestUserByPhone(phone: string) {
  return db.user.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUserWithPhone(phone: string) {
  return db.user.create({
    data: { phone },
  });
}

export async function markPhoneVerified(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { phoneVerifiedAt: new Date() },
  });
}
