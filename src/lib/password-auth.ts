import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_HASH_BYTES = 64;

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function verifyScryptPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = Buffer.from(parts[1], "base64");
  const expectedHash = Buffer.from(parts[2], "base64");
  if (salt.length === 0 || expectedHash.length === 0) {
    return false;
  }

  const derived = scryptSync(password, salt, expectedHash.length);
  return timingSafeEqual(derived, expectedHash);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_HASH_BYTES);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyConfiguredPassword(
  password: string,
  config: { plain?: string; hash?: string },
): boolean {
  if (config.hash) {
    return verifyScryptPassword(password, config.hash);
  }

  if (config.plain) {
    return timingSafeStringEqual(password, config.plain);
  }

  return false;
}
