/**
 * Creates the first admin StaffUser when none exists (idempotent).
 * Run: tsx scripts/seed-admin-user.ts
 *
 * Env: ADMIN_BOOTSTRAP_PHONE, ADMIN_BOOTSTRAP_PASSWORD
 * Falls back to ADMIN_PASSWORD when bootstrap password is unset.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password-auth";
import { normalizePhone } from "../src/modules/auth/auth.validators";

const IRAN_MOBILE_REGEX = /^09\d{9}$/;

const prisma = new PrismaClient();

function resolveBootstrapPhone(): string {
  const raw =
    process.env.ADMIN_BOOTSTRAP_PHONE?.trim() ||
    process.env.ADMIN_PHONE?.trim() ||
    "09120000000";

  const normalized = normalizePhone(raw);
  if (!normalized || !IRAN_MOBILE_REGEX.test(normalized)) {
    throw new Error(
      `Invalid ADMIN_BOOTSTRAP_PHONE: ${raw}. Expected Iranian mobile format (09XXXXXXXXX).`,
    );
  }

  return normalized;
}

function resolveBootstrapPassword(): string {
  const password =
    process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD?.trim();

  if (!password) {
    throw new Error(
      "Set ADMIN_BOOTSTRAP_PASSWORD or ADMIN_PASSWORD before running seed-admin-user.",
    );
  }

  return password;
}

async function main() {
  const existingAdmins = await prisma.staffUser.count({
    where: { role: "admin" },
  });

  if (existingAdmins > 0) {
    console.log(
      `Skipped: ${existingAdmins} admin StaffUser record(s) already exist.`,
    );
    return;
  }

  const phone = resolveBootstrapPhone();
  const password = resolveBootstrapPassword();
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "ادمین";

  const user = await prisma.staffUser.create({
    data: {
      name,
      phone,
      passwordHash: hashPassword(password),
      role: "admin",
    },
  });

  console.log(`Created bootstrap admin StaffUser: ${user.name} (${user.phone})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
