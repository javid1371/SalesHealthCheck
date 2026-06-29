import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const USER_SESSION_COOKIE = "shc_user_session";
export const ADMIN_SESSION_COOKIE = "shc_admin_session";

const DEFAULT_USER_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_ADMIN_TTL_SECONDS = 60 * 60 * 24;

export type UserSession = {
  userId: string;
};

export type AdminSession = {
  role: "admin";
};

type UserSessionPayload = {
  userId: string;
  exp: number;
};

type AdminSessionPayload = {
  role: "admin";
  exp: number;
};

type SessionScope = "user" | "admin" | "all";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function signPayload(payload: UserSessionPayload | AdminSessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", env.authSessionSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifySignedPayload<T extends { exp: number }>(
  value: string | undefined,
): T | null {
  if (!value) {
    return null;
  }

  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const payloadB64 = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", env.authSessionSecret)
    .update(payloadB64)
    .digest("base64url");

  if (!timingSafeCompare(signature, expectedSignature)) {
    return null;
  }

  let payload: T;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds()) {
    return null;
  }

  return payload;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function encodeUserSession(userId: string, ttlSeconds: number): string {
  const payload: UserSessionPayload = {
    userId,
    exp: nowSeconds() + ttlSeconds,
  };
  return signPayload(payload);
}

function encodeAdminSession(ttlSeconds: number): string {
  const payload: AdminSessionPayload = {
    role: "admin",
    exp: nowSeconds() + ttlSeconds,
  };
  return signPayload(payload);
}

/** Parse a signed user session cookie value (e.g. from `NextRequest.cookies`). */
export function parseUserSessionCookie(
  value: string | undefined,
): UserSession | null {
  const payload = verifySignedPayload<UserSessionPayload>(value);
  if (
    !payload ||
    typeof payload.userId !== "string" ||
    payload.userId.length === 0
  ) {
    return null;
  }
  return { userId: payload.userId };
}

/** Parse a signed admin session cookie value (e.g. from `NextRequest.cookies`). */
export function parseAdminSessionCookie(
  value: string | undefined,
): AdminSession | null {
  const payload = verifySignedPayload<AdminSessionPayload>(value);
  if (!payload || payload.role !== "admin") {
    return null;
  }
  return { role: "admin" };
}

export async function createUserSession(
  userId: string,
  options?: { ttlSeconds?: number },
): Promise<UserSession> {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_USER_TTL_SECONDS;
  const value = encodeUserSession(userId, ttlSeconds);
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, value, cookieOptions(ttlSeconds));
  return { userId };
}

export async function readUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  return parseUserSessionCookie(cookieStore.get(USER_SESSION_COOKIE)?.value);
}

export async function createAdminSession(
  options?: { ttlSeconds?: number },
): Promise<AdminSession> {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_ADMIN_TTL_SECONDS;
  const value = encodeAdminSession(ttlSeconds);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, value, cookieOptions(ttlSeconds));
  return { role: "admin" };
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return parseAdminSessionCookie(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

export async function clearSession(scope: SessionScope = "all"): Promise<void> {
  const cookieStore = await cookies();
  if (scope === "user" || scope === "all") {
    cookieStore.delete(USER_SESSION_COOKIE);
  }
  if (scope === "admin" || scope === "all") {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
  }
}

type RequestCookieReader = {
  cookies: {
    get: (name: string) => { value: string } | undefined;
  };
};

/** Read signed user/admin session cookies from an incoming request. */
export function readSessionsFromRequest(request: RequestCookieReader): {
  userSession: UserSession | null;
  adminSession: AdminSession | null;
} {
  return {
    userSession: parseUserSessionCookie(
      request.cookies.get(USER_SESSION_COOKIE)?.value,
    ),
    adminSession: parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    ),
  };
}
